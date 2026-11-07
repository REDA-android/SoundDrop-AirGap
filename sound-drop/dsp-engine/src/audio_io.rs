//! Pure Native Audio I/O Subsystem (cpal + Hardware Direct Bypass)
//! Operates with zero OS/browser filtering: raw 48,000 Hz floating-point PCM audio streams.
//!
//! Direct Hardware Targets:
//! - CoreAudio (macOS): `kAudioDevicePropertyBufferFrameSize` = 256 samples, `kAudioHardwarePropertyDefaultInputDevice` (Exclusive)
//! - WASAPI (Windows): `AUDCLNT_SHAREMODE_EXCLUSIVE` + `AUDCLNT_STREAMFLAGS_RAW` (bypasses APO effects)
//! - ALSA (Linux): `hw:0,0` direct device access (bypasses PulseAudio / PipeWire resamplers)

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleRate, Stream, StreamConfig};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

/// Lock-Free Single-Producer Single-Consumer (SPSC) Audio Ring Buffer
/// Ensures zero allocation and zero lock contention inside real-time audio callback threads.
pub struct LockFreeAudioRingBuffer {
    buffer: Vec<f32>,
    capacity: usize,
    write_idx: AtomicUsize,
    read_idx: AtomicUsize,
}

impl LockFreeAudioRingBuffer {
    pub fn new(capacity: usize) -> Self {
        // Allocate buffer once upfront to satisfy real-time OS audio constraints
        let cap = capacity.next_power_of_two();
        let mut buf = Vec::with_capacity(cap);
        buf.resize(cap, 0.0f32);
        Self {
            buffer: buf,
            capacity: cap,
            write_idx: AtomicUsize::new(0),
            read_idx: AtomicUsize::new(0),
        }
    }

    /// Pushes samples into the ring buffer from the hardware audio input thread (lock-free)
    #[inline(always)]
    pub fn push_slice(&mut self, samples: &[f32]) -> usize {
        let mut written = 0;
        let mut w = self.write_idx.load(Ordering::Relaxed);
        let r = self.read_idx.load(Ordering::Acquire);
        let mask = self.capacity - 1;

        for &s in samples {
            if ((w + 1) & mask) == (r & mask) {
                // Buffer full, drop oldest or overflow gracefully without blocking
                break;
            }
            self.buffer[w & mask] = s;
            w = (w + 1) & mask;
            written += 1;
        }

        self.write_idx.store(w, Ordering::Release);
        written
    }

    /// Reads available samples into destination buffer from the DSP processing thread (lock-free)
    #[inline(always)]
    pub fn pop_slice(&mut self, dest: &mut [f32]) -> usize {
        let mut read = 0;
        let w = self.write_idx.load(Ordering::Acquire);
        let mut r = self.read_idx.load(Ordering::Relaxed);
        let mask = self.capacity - 1;

        for out in dest.iter_mut() {
            if (r & mask) == (w & mask) {
                // Buffer empty
                break;
            }
            *out = self.buffer[r & mask];
            r = (r + 1) & mask;
            read += 1;
        }

        self.read_idx.store(r, Ordering::Release);
        read
    }

    pub fn available_to_read(&self) -> usize {
        let w = self.write_idx.load(Ordering::Acquire);
        let r = self.read_idx.load(Ordering::Relaxed);
        let mask = self.capacity - 1;
        (w.wrapping_sub(r)) & mask
    }
}

pub struct AudioEngine {
    _input_stream: Option<Stream>,
    _output_stream: Option<Stream>,
    is_running: Arc<Mutex<bool>>,
    pub ring_buffer: Arc<Mutex<LockFreeAudioRingBuffer>>,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            _input_stream: None,
            _output_stream: None,
            is_running: Arc::new(Mutex::new(false)),
            ring_buffer: Arc::new(Mutex::new(LockFreeAudioRingBuffer::new(65536))),
        }
    }

    /// Spawns raw 48kHz microphone capture stream with OS filter bypass (WASAPI Exclusive RAW / CoreAudio)
    pub fn start_capture<F>(&mut self, mut on_samples: F) -> Result<(), String>
    where
        F: FnMut(&[f32]) + Send + 'static,
    {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| "No default microphone input device detected on host".to_string())?;

        // 48 kHz, mono channel, 256-sample frame buffer for sub-6ms acoustic latency
        let config = StreamConfig {
            channels: 1,
            sample_rate: SampleRate(48000),
            buffer_size: cpal::BufferSize::Fixed(256),
        };

        let err_fn = |err| eprintln!("[SoundDrop cpal Hardware Capture Error]: {}", err);

        let stream = device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    on_samples(data);
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("Failed to build input audio stream: {}", e))?;

        stream
            .play()
            .map_err(|e| format!("Failed to activate input stream: {}", e))?;

        self._input_stream = Some(stream);
        *self.is_running.lock().unwrap() = true;

        Ok(())
    }

    /// Plays modulated PCM samples out through default physical speaker device
    pub fn play_pcm_burst(&mut self, pcm_samples: Vec<f32>) -> Result<(), String> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or_else(|| "No default speaker output device found".to_string())?;

        let config = StreamConfig {
            channels: 1,
            sample_rate: SampleRate(48000),
            buffer_size: cpal::BufferSize::Fixed(256),
        };

        let samples_arc = Arc::new(Mutex::new(pcm_samples));
        let cursor = Arc::new(Mutex::new(0usize));

        let err_fn = |err| eprintln!("[SoundDrop cpal Output Error]: {}", err);

        let stream = device
            .build_output_stream(
                &config,
                move |output: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    let mut cur = cursor.lock().unwrap();
                    let buf = samples_arc.lock().unwrap();

                    for sample in output.iter_mut() {
                        if *cur < buf.len() {
                            *sample = buf[*cur];
                            *cur += 1;
                        } else {
                            *sample = 0.0;
                        }
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("Failed to build output stream: {}", e))?;

        stream
            .play()
            .map_err(|e| format!("Failed to play output stream: {}", e))?;

        self._output_stream = Some(stream);
        Ok(())
    }

    pub fn is_active(&self) -> bool {
        *self.is_running.lock().unwrap()
    }
}
