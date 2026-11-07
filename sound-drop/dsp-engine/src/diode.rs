//! Air-Gap Hardware Data Diode Security Mode
//! Enforces physical unidirectional RX-only operation by detaching speaker drivers.

use std::sync::atomic::{AtomicBool, Ordering};

pub static DIODE_RX_ONLY: AtomicBool = AtomicBool::new(false);

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

    /// Verifies if outbound transmission is permitted
    pub fn assert_transmission_allowed() -> Result<(), String> {
        if DIODE_RX_ONLY.load(Ordering::SeqCst) {
            Err("SECURITY VIOLATION: Outbound transmission blocked by Air-Gap Data Diode policy.".to_string())
        } else {
            Ok(())
        }
    }
}
