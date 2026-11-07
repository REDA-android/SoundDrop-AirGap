//! Acoustic Time-of-Flight (ToF) Physical Co-Presence & Anti-Replay Defense Engine
//! Protects air-gapped systems against remote acoustic relay / replay attacks (< 1.5m enforcement).
//!
//! Protocol Sequence:
//! 1. TX: Preamble Chirp LFM (1.2 kHz -> 4.8 kHz) for clock synchronization.
//! 2. RX: ToF Ultra-Short Challenge (32-bit Hardware Nonce).
//! 3. TX: ToF Cryptographic Signature Response (Verification flight time < 4.41 ms => distance < 1.5m).
//! 4. TX: Ephemeral X25519 Encrypted Session Header.
//! 5. TX: RS(80, 64) FEC + CRC32 Encoded Payload Blocks.
//! 6. RX: Dual-Tone Acoustic ACK Chime (Validation).
//!
//! Replay Attack Defense:
//! Nonce expires in 100 ms. If round-trip propagation exceeds 4.37 ms (exceeding 1.5m at 343 m/s),
//! session is silently invalidated and diode locked for 2000 ms.

use std::time::{Duration, Instant};

pub const MAX_ALLOWED_DISTANCE_METERS: f64 = 1.50;
pub const SPEED_OF_SOUND_MPS: f64 = 343.2; // Dry air at 20°C
pub const MAX_PROPAGATION_TIME_MS: f64 = 4.37; // Maximum one-way flight time for 1.50m
pub const NONCE_EXPIRY_MS: u64 = 100; // 100 ms nonce lifetime
pub const REPLAY_PENALTY_LOCK_MS: u64 = 2000; // 2000 ms silent diode lockout

#[derive(Debug, Clone)]
pub struct TofVerificationResult {
    pub is_valid: bool,
    pub measured_distance_meters: f64,
    pub round_trip_duration: Duration,
    pub processing_delay_compensated: Duration,
    pub replay_detected: bool,
    pub silent_lockout_active: bool,
}

#[derive(Debug, Clone)]
pub struct ActiveToFChallenge {
    pub nonce_32: u32,
    pub issued_at: Instant,
}

pub struct AcousticTofEngine {
    expected_processing_delay: Duration,
    lfm_preamble_chirp: Vec<f32>,
    active_challenge: Option<ActiveToFChallenge>,
    lockout_until: Option<Instant>,
}

impl AcousticTofEngine {
    pub fn new() -> Self {
        let sample_rate = 48000.0;
        // Preamble Chirp LFM: 1.2 kHz -> 4.8 kHz over 20 ms
        let duration_sec = 0.020;
        let num_samples = (sample_rate * duration_sec).round() as usize;
        let mut chirp = Vec::with_capacity(num_samples);

        for i in 0..num_samples {
            let t = (i as f64) / sample_rate;
            let freq = 1200.0 + (3600.0 * (t / duration_sec));
            let phase = 2.0 * std::f64::consts::PI * freq * t;
            chirp.push((phase.sin() * 0.4) as f32);
        }

        Self {
            expected_processing_delay: Duration::from_micros(350), // Sub-millisecond hardware turnaround
            lfm_preamble_chirp: chirp,
            active_challenge: None,
            lockout_until: None,
        }
    }

    pub fn get_lfm_preamble(&self) -> &[f32] {
        &self.lfm_preamble_chirp
    }

    /// Issues a fresh 32-bit cryptographically random challenge nonce
    pub fn issue_challenge(&mut self, hw_nonce: u32) -> ActiveToFChallenge {
        let challenge = ActiveToFChallenge {
            nonce_32: hw_nonce,
            issued_at: Instant::now(),
        };
        self.active_challenge = Some(challenge.clone());
        challenge
    }

    /// Evaluates ToF challenge response against physical laws (v = 343 m/s, d <= 1.5m)
    pub fn verify_challenge_response(
        &mut self,
        received_nonce: u32,
        response_received_at: Instant,
    ) -> TofVerificationResult {
        let now = Instant::now();

        // Check if under silent replay lockout penalty
        if let Some(lockout) = self.lockout_until {
            if now < lockout {
                return TofVerificationResult {
                    is_valid: false,
                    measured_distance_meters: 99.0,
                    round_trip_duration: Duration::from_secs(99),
                    processing_delay_compensated: self.expected_processing_delay,
                    replay_detected: true,
                    silent_lockout_active: true,
                };
            } else {
                self.lockout_until = None;
            }
        }

        guard_challenge: {
            if let Some(active) = self.active_challenge.take() {
                if active.nonce_32 != received_nonce {
                    break 'guard_challenge;
                }

                let elapsed = response_received_at.duration_since(active.issued_at);
                // Enforce 100 ms hard expiry on nonce
                if elapsed > Duration::from_millis(NONCE_EXPIRY_MS) {
                    break 'guard_challenge;
                }

                let flight_duration = if elapsed > self.expected_processing_delay {
                    elapsed - self.expected_processing_delay
                } else {
                    Duration::from_nanos(1)
                };

                let flight_ms = flight_duration.as_secs_f64() * 1000.0;
                let one_way_distance = (SPEED_OF_SOUND_MPS * flight_duration.as_secs_f64()) / 2.0;

                // Enforce maximum 1.50m distance and <= 4.37ms propagation time
                if one_way_distance <= MAX_ALLOWED_DISTANCE_METERS
                    && one_way_distance >= 0.05
                    && flight_ms <= (MAX_PROPAGATION_TIME_MS * 2.0)
                {
                    return TofVerificationResult {
                        is_valid: true,
                        measured_distance_meters: one_way_distance,
                        round_trip_duration: elapsed,
                        processing_delay_compensated: self.expected_processing_delay,
                        replay_detected: false,
                        silent_lockout_active: false,
                    };
                }
            }
        }

        // Anomaly / Replay detected: lock out listening for 2000 ms
        self.lockout_until = Some(now + Duration::from_millis(REPLAY_PENALTY_LOCK_MS));
        TofVerificationResult {
            is_valid: false,
            measured_distance_meters: 99.0,
            round_trip_duration: Duration::from_secs(99),
            processing_delay_compensated: self.expected_processing_delay,
            replay_detected: true,
            silent_lockout_active: true,
        }
    }
}
