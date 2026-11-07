//! Acoustic Time-of-Flight (ToF) Physical Co-Presence Verification Engine
//! Protects air-gapped systems against remote acoustic relay / replay attacks (< 1.5m enforcement).

use std::time::{Duration, Instant};

pub const MAX_ALLOWED_DISTANCE_METERS: f64 = 1.50;
pub const SPEED_OF_SOUND_MPS: f64 = 343.2; // Dry air at 20°C

#[derive(Debug, Clone)]
pub struct TofVerificationResult {
    pub is_valid: bool,
    pub measured_distance_meters: f64,
    pub round_trip_duration: Duration,
    pub processing_delay_compensated: Duration,
}

pub struct AcousticTofEngine {
    expected_processing_delay: Duration,
    micro_chirp_waveform: Vec<f32>,
}

impl AcousticTofEngine {
    pub fn new() -> Self {
        // Synthesizes 15ms micro-chirp at 20.2 kHz
        let sample_rate = 48000.0;
        let duration_sec = 0.015; // 15ms
        let num_samples = (sample_rate * duration_sec).round() as usize;
        let mut chirp = Vec::with_capacity(num_samples);

        for i in 0..num_samples {
            let t = (i as f64) / sample_rate;
            // High ultrasonic sweep: 19500 Hz -> 20500 Hz
            let freq = 19500.0 + (1000.0 * (t / duration_sec));
            let phase = 2.0 * std::f64::consts::PI * freq * t;
            chirp.push((phase.sin() * 0.3) as f32);
        }

        Self {
            expected_processing_delay: Duration::from_millis(18), // Deterministic DSP turnaround
            micro_chirp_waveform: chirp,
        }
    }

    pub fn get_probe_waveform(&self) -> &[f32] {
        &self.micro_chirp_waveform
    }

    /// Evaluates physical co-presence distance:
    /// d = v_sound * (Delta_t - t_processing) / 2
    pub fn verify_co_presence(
        &self,
        ping_sent_time: Instant,
        pong_received_time: Instant,
    ) -> TofVerificationResult {
        let total_round_trip = pong_received_time.duration_since(ping_sent_time);

        // Subtract calibrated deterministic turnaround delay
        let acoustic_flight_time = if total_round_trip > self.expected_processing_delay {
            total_round_trip - self.expected_processing_delay
        } else {
            Duration::from_nanos(1)
        };

        let flight_seconds = acoustic_flight_time.as_secs_f64();
        // One-way distance calculation
        let distance_meters = (SPEED_OF_SOUND_MPS * flight_seconds) / 2.0;

        let is_valid = distance_meters <= MAX_ALLOWED_DISTANCE_METERS && distance_meters >= 0.02;

        TofVerificationResult {
            is_valid,
            measured_distance_meters: distance_meters,
            round_trip_duration: total_round_trip,
            processing_delay_compensated: self.expected_processing_delay,
        }
    }
}
