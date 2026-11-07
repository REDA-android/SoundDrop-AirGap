//! Sound Drop Research-Grade DSP & Acoustic Cryptography Core
//! 100% Native, Zero-Browser, Air-Gapped Physical Layer Architecture.

pub mod audio_io;
pub mod diode;
pub mod doppler;
pub mod tof;

pub use audio_io::AudioEngine;
pub use diode::AirGapDataDiode;
pub use doppler::DopplerCompensator;
pub use tof::AcousticTofEngine;
