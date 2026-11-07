//! Sound Drop Native GPU Shell Entry Point (Zero-HTML/JS/CSS)
//! Compiles directly to machine code targeting OpenGL / Vulkan / Metal.

pub mod mascot_anim;
pub mod radar_renderer;

slint::include_modules!();

use sound_drop_dsp::diode::AirGapDataDiode;
use sound_drop_dsp::doppler::DopplerCompensator;
use sound_drop_dsp::tof::AcousticTofEngine;

fn main() -> Result<(), slint::PlatformError> {
    println!("[SoundDrop Native GUI] Initializing compiled Slint window (Zero-Web)...");

    let main_window = SoundDropWindow::new()?;

    // Wire: Emit Pairing Ping callback
    let handle = main_window.as_weak();
    main_window.on_emit_pairing_ping(move || {
        let ui = handle.upgrade().unwrap();
        ui.set_device_state("TRANSMITTING".into());
        println!("[Native GUI] Acoustic pairing ping burst emitted!");

        slint::Timer::single_shot(std::time::Duration::from_millis(600), move || {
            ui.set_device_state("STANDBY".into());
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
        println!("[Native GUI] Switched active band to: {}", band);
    });

    main_window.run()
}
