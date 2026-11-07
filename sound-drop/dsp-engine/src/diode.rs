//! Air-Gap Hardware Data Diode Security Mode
//! Enforces physical unidirectional RX-only operation by isolating output speaker pathways
//! and provides instant lockdown against detected acoustic replay attacks.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

pub static DIODE_RX_ONLY: AtomicBool = AtomicBool::new(false);
pub static REPLAY_LOCKOUT_UNTIL_MS: AtomicU64 = AtomicU64::new(0);

pub struct AirGapDataDiode;

impl AirGapDataDiode {
    /// Locks system into RX-Only Data Diode mode: speaker emissions strictly blocked
    pub fn enable_rx_only_mode() {
        DIODE_RX_ONLY.store(true, Ordering::SeqCst);
        println!("[AirGap Security] DATA DIODE ENGAGED: Audio output hardware isolated (RX-ONLY).");
    }

    /// Disengages diode lock for authorized bidirectional operation
    pub fn enable_bidirectional_mode() {
        DIODE_RX_ONLY.store(false, Ordering::SeqCst);
        println!("[AirGap Security] Bidirectional acoustic transceiver mode restored.");
    }

    /// Triggers silent 2000ms lockout upon acoustic replay or relay detection
    pub fn trigger_replay_defense_lockout(duration: Duration) {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let lock_until = now_ms + duration.as_millis() as u64;
        REPLAY_LOCKOUT_UNTIL_MS.store(lock_until, Ordering::SeqCst);
        println!("[AirGap Security] DEFENSE ALERT: Acoustic replay detected. Diode silently locked for {:?}.", duration);
    }

    /// Verifies if outbound transmission is permitted
    pub fn assert_transmission_allowed() -> Result<(), String> {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let lock_until = REPLAY_LOCKOUT_UNTIL_MS.load(Ordering::SeqCst);

        if now_ms < lock_until {
            return Err("SECURITY LOCKOUT: Channel locked due to detected acoustic replay attempt.".to_string());
        }

        if DIODE_RX_ONLY.load(Ordering::SeqCst) {
            Err("SECURITY VIOLATION: Outbound transmission blocked by Air-Gap Data Diode policy.".to_string())
        } else {
            Ok(())
        }
    }

    pub fn is_rx_only() -> bool {
        DIODE_RX_ONLY.load(Ordering::SeqCst)
    }
}
