//! Pure Native Audio I/O Subsystem (cpal)
//! Operates with zero OS/browser filtering: raw 48,000 Hz floating-point PCM audio streams.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleRate, Stream, StreamConfig};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};

pub struct AudioEngine {
    _input_stream: Option<Stream>,
    _output_stream: Option<Stream>,
    is_running: Arc<Mutex<bool>>,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            _input_stream: None,
            _output_stream: None,
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Spawns raw 48kHz microphone capture stream streaming Float32Array PCM chunks
    pub fn start_capture<F>(&mut self, mut on_samples: F) -> Result<(), String>
    where
        F: FnMut(&[f32]) + Send + 'static,
    {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| "No default microphone input device detected on host".to_string())?;

        let config = StreamConfig {
            channels: 1,
            sample_rate: SampleRate(48000),
            buffer_size: cpal::BufferSize::Fixed(2048),
        };

        let err_fn = |err| eprintln!("[SoundDrop cpal Capture Error]: {}", err);

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
            buffer_size: cpal::BufferSize::Default,
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

    pub fn stop(&mut self) {
        *self.is_running.lock().unwrap() = false;
        self._input_stream = None;
        self._output_stream = None;
    }
}
