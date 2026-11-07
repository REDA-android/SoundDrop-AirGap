//! Doppler Pilot Tone Tracking & Real-Time Frequency Bin Compensator
//! Continuously tracks a 16 kHz acoustic reference pilot tone using a Phase-Locked Loop (PLL).

use libc::{c_double, size_t};

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct DopplerTrackerC {
    pub sample_rate: f64,
    pub target_pilot_freq: f64,
    pub pll_phase: f64,
    pub pll_frequency: f64,
    pub loop_filter_state: f64,
    pub kp: f64,
    pub ki: f64,
    pub doppler_shift_hz: f64,
    pub lock_confidence: f64,
}

extern "C" {
    fn sounddrop_doppler_init(sample_rate: c_double, pilot_freq: c_double) -> DopplerTrackerC;
    fn sounddrop_doppler_track_block(
        tracker: *mut DopplerTrackerC,
        samples: *const f32,
        length: size_t,
    );
    fn sounddrop_goertzel_avx2_compensated(
        samples: *const f32,
        num_samples: size_t,
        sample_rate: c_double,
        base_frequencies: *const f64,
        num_frequencies: size_t,
        doppler_shift_hz: c_double,
        out_energies: *mut f64,
    );
}

pub struct DopplerCompensator {
    tracker: DopplerTrackerC,
    base_frequencies: Vec<f64>,
}

impl DopplerCompensator {
    pub fn new(sample_rate: f64, pilot_freq: f64, base_frequencies: Vec<f64>) -> Self {
        let tracker = unsafe { sounddrop_doppler_init(sample_rate, pilot_freq) };
        Self {
            tracker,
            base_frequencies,
        }
    }

    /// Feeds incoming audio block to PLL, tracks pilot tone phase drift, and updates Doppler shift
    pub fn process_audio_block(&mut self, samples: &[f32]) -> (f64, f64) {
        unsafe {
            sounddrop_doppler_track_block(
                &mut self.tracker,
                samples.as_ptr(),
                samples.len(),
            );
        }
        (self.tracker.doppler_shift_hz, self.tracker.lock_confidence)
    }

    /// Evaluates 16-FSK tone energies with center frequencies compensated by -Delta_f
    pub fn evaluate_compensated_energies(&self, samples: &[f32]) -> Vec<f64> {
        let mut energies = vec![0.0f64; self.base_frequencies.len()];
        unsafe {
            sounddrop_goertzel_avx2_compensated(
                samples.as_ptr(),
                samples.len(),
                self.tracker.sample_rate,
                self.base_frequencies.as_ptr(),
                self.base_frequencies.len(),
                -self.tracker.doppler_shift_hz, // Inverted to cancel motion drift
                energies.as_mut_ptr(),
            );
        }
        energies
    }

    pub fn get_doppler_shift(&self) -> f64 {
        self.tracker.doppler_shift_hz
    }

    pub fn get_confidence(&self) -> f64 {
        self.tracker.lock_confidence
    }
}
