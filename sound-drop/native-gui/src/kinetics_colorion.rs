//! Kinetics Colorion Dynamic Mesh Shader Engine (Zero-Web GLSL/Metal Mathematical Port)
//! Implements 4-Pole Dynamic Multi-Spectral Chromatic Interpolation:
//! - Pole 1 (NW): f(Noise Floor, SNR)
//! - Pole 2 (NE): f(Doppler Shift Δf)
//! - Pole 3 (SW): f(Audio Buffer Health)
//! - Pole 4 (SE): f(Carrier Frequency)
//!
//! Formulas:
//! - Bilinear Spatial Weights: w1 = (1-x)(1-y), w2 = x(1-y), w3 = (1-x)y, w4 = xy
//! - Kinetic Vector: P_k(t) = BaseColor_k + ΔColor_k * sin(omega_k * t + phi_k * A_RMS)
//! - Color: C(x, y, t) = Sum_{k=1}^4 w_k(x, y) * P_k(t)

#[derive(Debug, Clone, Copy)]
pub struct ColorRgb {
    pub r: f32,
    pub g: f32,
    pub b: f32,
}

impl ColorRgb {
    pub const fn new(r: f32, g: f32, b: f32) -> Self {
        Self { r, g, b }
    }

    pub fn from_hex(hex: u32) -> Self {
        Self {
            r: ((hex >> 16) & 0xFF) as f32 / 255.0,
            g: ((hex >> 8) & 0xFF) as f32 / 255.0,
            b: (hex & 0xFF) as f32 / 255.0,
        }
    }

    pub fn to_hex_string(&self) -> String {
        format!(
            "#{:02x}{:02x}{:02x}",
            (self.r.clamp(0.0, 1.0) * 255.0).round() as u8,
            (self.g.clamp(0.0, 1.0) * 255.0).round() as u8,
            (self.b.clamp(0.0, 1.0) * 255.0).round() as u8,
        )
    }

    pub fn lerp(a: ColorRgb, b: ColorRgb, t: f32) -> Self {
        let factor = t.clamp(0.0, 1.0);
        Self {
            r: a.r + (b.r - a.r) * factor,
            g: a.g + (b.g - a.g) * factor,
            b: a.b + (b.b - a.b) * factor,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AcousticColorState {
    StandbyAirGap,
    ListenSyncSeeking,
    SignalDetectedValidParity,
}

pub struct KineticPole {
    pub base_color: ColorRgb,
    pub delta_color: ColorRgb,
    pub omega: f32,
    pub phi: f32,
}

pub struct KineticsColorionEngine {
    state: AcousticColorState,
    poles: [KineticPole; 4],
    transition_progress: f32, // 0.0 -> 1.0 over 350ms
}

impl KineticsColorionEngine {
    pub fn new() -> Self {
        Self {
            state: AcousticColorState::StandbyAirGap,
            poles: [
                // Pole 1: NW (Noise floor / SNR) - Obsidian Slate
                KineticPole {
                    base_color: ColorRgb::from_hex(0x060709),
                    delta_color: ColorRgb::new(0.02, 0.03, 0.05),
                    omega: 1.2,
                    phi: 0.8,
                },
                // Pole 2: NE (Doppler Shift Δf) - Spectral Cobalt
                KineticPole {
                    base_color: ColorRgb::from_hex(0x0D1B2A),
                    delta_color: ColorRgb::new(0.04, 0.08, 0.16),
                    omega: 1.8,
                    phi: 1.2,
                },
                // Pole 3: SW (Audio Buffer Health) - Deep Ink
                KineticPole {
                    base_color: ColorRgb::from_hex(0x080C14),
                    delta_color: ColorRgb::new(0.01, 0.05, 0.10),
                    omega: 0.9,
                    phi: 0.5,
                },
                // Pole 4: SE (Carrier Frequency) - Titanium Indigo
                KineticPole {
                    base_color: ColorRgb::from_hex(0x1B263B),
                    delta_color: ColorRgb::new(0.05, 0.10, 0.18),
                    omega: 2.1,
                    phi: 1.5,
                },
            ],
            transition_progress: 0.0,
        }
    }

    pub fn set_state(&mut self, next: AcousticColorState) {
        if self.state != next {
            self.state = next;
            self.transition_progress = 0.0;
        }
    }

    /// Advances state by delta_time (dt in seconds) and RMS acoustic energy
    pub fn update(&mut self, dt: f32, _a_rms: f32) {
        if self.transition_progress < 1.0 {
            // 350ms transition
            self.transition_progress = (self.transition_progress + (dt / 0.350)).min(1.0);
        }
    }

    /// Evaluates multi-spectral color C(x, y, t) at normalized coordinates (x, y) in [0, 1]
    pub fn evaluate_color(&self, x: f32, y: f32, t: f32, a_rms: f32) -> ColorRgb {
        let x_c = x.clamp(0.0, 1.0);
        let y_c = y.clamp(0.0, 1.0);

        // Bilinear spatial weights
        let w = [
            (1.0 - x_c) * (1.0 - y_c), // w1 (NW)
            x_c * (1.0 - y_c),         // w2 (NE)
            (1.0 - x_c) * y_c,         // w3 (SW)
            x_c * y_c,                 // w4 (SE)
        ];

        let mut r = 0.0f32;
        let mut g = 0.0f32;
        let mut b = 0.0f32;

        for k in 0..4 {
            let pole = &self.poles[k];
            let oscillation = (pole.omega * t + pole.phi * a_rms).sin();

            let target_color = match self.state {
                AcousticColorState::StandbyAirGap => ColorRgb {
                    r: pole.base_color.r + pole.delta_color.r * oscillation,
                    g: pole.base_color.g + pole.delta_color.g * oscillation,
                    b: pole.base_color.b + pole.delta_color.b * oscillation,
                },
                AcousticColorState::ListenSyncSeeking => {
                    // Cyan-indigo polished waves pulsing with noise floor
                    let pulse = (t * 2.5 + a_rms * 4.0).sin() * 0.15;
                    ColorRgb {
                        r: 0.03 + pulse * 0.02,
                        g: 0.12 + pulse * 0.08,
                        b: 0.28 + pulse * 0.15,
                    }
                }
                AcousticColorState::SignalDetectedValidParity => {
                    // Aurora borealis electric emerald (#00F5D4) & titanium gold (#FFD166)
                    let emerald = ColorRgb::from_hex(0x00F5D4);
                    let gold = ColorRgb::from_hex(0xFFD166);
                    let mix = (t * 3.2 + (k as f32) * 1.5).sin() * 0.5 + 0.5;
                    ColorRgb::lerp(emerald, gold, mix)
                }
            };

            r += w[k] * target_color.r;
            g += w[k] * target_color.g;
            b += w[k] * target_color.b;
        }

        ColorRgb {
            r: r.clamp(0.0, 1.0),
            g: g.clamp(0.0, 1.0),
            b: b.clamp(0.0, 1.0),
        }
    }
}
