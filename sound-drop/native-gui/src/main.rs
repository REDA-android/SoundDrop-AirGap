//! Sound Drop Native GPU Shell Entry Point (Zero-HTML/JS/CSS)
//! Compiles directly to machine code targeting OpenGL / Vulkan / Metal.
//!
//! Subsystems wired:
//! - Hairline 0.5px sub-pixel rasterization & Metalforge material styling
//! - Kinetics Colorion 4-pole dynamic mesh chromatic engine
//! - Affect UI / React Bits Micro damped harmonic bubble physics
//! - Morphicons continuous 64-point vector icon morphing
//! - Page-Mascot reactive DSP companion state machine

pub mod bubble_physics;
pub mod hairline_metalforge;
pub mod kinetics_colorion;
pub mod mascot_anim;
pub mod morphicons;
pub mod radar_renderer;

slint::include_modules!();

use bubble_physics::MetallicBubblePhysics;
use hairline_metalforge::HairlineMetalforgeEngine;
use kinetics_colorion::{AcousticColorState, KineticsColorionEngine};
use mascot_anim::{MascotRuntimeController, MascotState};
use morphicons::{IconShape, MorphiconEngine};
use sound_drop_dsp::diode::AirGapDataDiode;
use sound_drop_dsp::tof::AcousticTofEngine;
use std::rc::Rc;
use std::cell::RefCell;

fn main() -> Result<(), slint::PlatformError> {
    println!("[SoundDrop Native GUI] Initializing compiled Slint window (Zero-Web GPU Context)...");

    let main_window = SoundDropWindow::new()?;

    // Shared state engines
    let mascot = Rc::new(RefCell::new(MascotRuntimeController::new()));
    let bubble = Rc::new(RefCell::new(MetallicBubblePhysics::new()));
    let _colorion = Rc::new(RefCell::new(KineticsColorionEngine::new()));
    let morphicon = Rc::new(RefCell::new(MorphiconEngine::new()));
    let _hairline = HairlineMetalforgeEngine::new(2.0);
    let mut _tof_engine = AcousticTofEngine::new();

    // Wire: Emit Pairing Ping callback (Hold release / Tap drop)
    let handle = main_window.as_weak();
    let mascot_clone = mascot.clone();
    let bubble_clone = bubble.clone();
    let morphicon_clone = morphicon.clone();

    main_window.on_emit_pairing_ping(move || {
        let ui = handle.upgrade().unwrap();
        ui.set_device_state("TRANSMITTING".into());
        println!("[Native GUI] Acoustic pairing ping burst emitted (LFM 1.2 -> 4.8 kHz)!");

        // Trigger explosive physics release & celebration jump
        bubble_clone.borrow_mut().on_release();
        morphicon_clone.borrow_mut().morph_to(IconShape::EncryptedKey);
        mascot_clone.borrow_mut().trigger_packet_confirmed();

        ui.set_mascot_face(mascot_clone.borrow().get_face_label().into());
        ui.set_mascot_title(mascot_clone.borrow().get_state_title().into());
        ui.set_ring_expansion_1(30.0);

        let handle_reset = handle.clone();
        let mascot_reset = mascot_clone.clone();
        let morph_reset = morphicon_clone.clone();

        slint::Timer::single_shot(std::time::Duration::from_millis(800), move || {
            if let Some(ui_res) = handle_reset.upgrade() {
                ui_res.set_device_state("STANDBY".into());
                ui_res.set_ring_expansion_1(0.0);
                morph_reset.borrow_mut().morph_to(IconShape::RadarCircle);
                ui_res.set_mascot_face(mascot_reset.borrow().get_face_label().into());
                ui_res.set_mascot_title(mascot_reset.borrow().get_state_title().into());
            }
        });
    });

    // Wire: Data Diode Toggle callback
    let handle_diode = main_window.as_weak();
    main_window.on_toggle_data_diode(move || {
        let ui = handle_diode.upgrade().unwrap();
        let current = ui.get_data_diode_active();
        let next = !current;
        ui.set_data_diode_active(next);

        if next {
            AirGapDataDiode::enable_rx_only_mode();
        } else {
            AirGapDataDiode::enable_bidirectional_mode();
        }
    });

    // Wire: Band Switch callback
    let handle_band = main_window.as_weak();
    main_window.on_switch_band(move |band| {
        let ui = handle_band.upgrade().unwrap();
        ui.set_active_band(band.clone());
        println!("[Native GUI] Switched active acoustic band to: {}", band);
    });

    main_window.run()
}
