//! Page-Mascot Native Runtime & Vector State Machine
//! Real-time embodiment of the Digital Signal Processing (DSP) acoustic subsystem.
//!
//! Vector State Matrix:
//! - STANDBY: Calm levitation (0.5 Hz), gaze follows cursor, passive micro-halo.
//! - LISTEN_CHIRP: Head tilted (45 deg), eyes wide open fixed, concentric listening lines.
//! - SNR_CRITICAL: Hands over ears, anxious blink, drawn exclamation mark.
//! - DOPPLER_SHIFT: Body leaning against sound, oriented gaze, visible velocity vector.
//! - BURST_RECEIVE: Arms deployed forward, sharp central focus, absorption trajectories.
//! - PACKET_CONFIRMED: Celebration jump, dynamic stars, particle burst.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MascotState {
    Standby,
    ListenChirp,
    SnrCritical,
    DopplerShift,
    BurstReceive,
    PacketConfirmed,
}

#[derive(Debug, Clone)]
pub struct Particle2D {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub life: f32,
    pub color_hex: u32,
}

pub struct MascotRuntimeController {
    pub current_state: MascotState,
    pub levitation_offset_y: f32,
    pub head_tilt_deg: f32,
    pub body_lean_deg: f32,
    pub gaze_x: f32,
    pub gaze_y: f32,
    pub blink_factor: f32,
    pub celebration_jump_y: f32,
    pub celebration_timer: f32,
    pub particles: Vec<Particle2D>,
    time_accum: f32,
}

impl MascotRuntimeController {
    pub fn new() -> Self {
        Self {
            current_state: MascotState::Standby,
            levitation_offset_y: 0.0,
            head_tilt_deg: 0.0,
            body_lean_deg: 0.0,
            gaze_x: 0.0,
            gaze_y: 0.0,
            blink_factor: 1.0,
            celebration_jump_y: 0.0,
            celebration_timer: 0.0,
            particles: Vec::with_capacity(32),
            time_accum: 0.0,
        }
    }

    /// Triggers celebration jump and particle burst upon successful packet reception
    pub fn trigger_packet_confirmed(&mut self) {
        self.current_state = MascotState::PacketConfirmed;
        self.celebration_timer = 1.2; // 1.2 seconds of celebration
        self.celebration_jump_y = -22.0;

        // Spawn dynamic celebratory star particles
        self.particles.clear();
        for i in 0..16 {
            let angle = (i as f32) * (2.0 * std::f32::consts::PI / 16.0);
            let speed = 45.0 + ((i % 3) as f32) * 15.0;
            self.particles.push(Particle2D {
                x: 0.0,
                y: -10.0,
                vx: angle.cos() * speed,
                vy: angle.sin() * speed - 15.0,
                life: 1.0,
                color_hex: if i % 2 == 0 { 0x00F5D4 } else { 0xFFD166 },
            });
        }
    }

    /// Updates procedural animation variables frame-by-frame
    pub fn update(
        &mut self,
        dt: f32,
        snr_db: f32,
        doppler_shift_hz: f32,
        is_receiving: bool,
        is_listening: bool,
        cursor_rel_x: f32,
        cursor_rel_y: f32,
    ) {
        self.time_accum += dt;

        // Manage celebration timer
        if self.celebration_timer > 0.0 {
            self.celebration_timer -= dt;
            self.celebration_jump_y = -((self.celebration_timer * 8.0).sin().abs()) * 18.0;

            // Update celebratory particles
            let mut i = 0;
            while i < self.particles.len() {
                self.particles[i].x += self.particles[i].vx * dt;
                self.particles[i].y += self.particles[i].vy * dt;
                self.particles[i].vy += 60.0 * dt; // Gravity
                self.particles[i].life -= dt * 0.9;
                if self.particles[i].life <= 0.0 {
                    self.particles.remove(i);
                } else {
                    i += 1;
                }
            }

            if self.celebration_timer <= 0.0 {
                self.current_state = MascotState::Standby;
                self.celebration_jump_y = 0.0;
            }
            return;
        }

        // Determine mascot state from live DSP telemetry
        if snr_db < 10.0 && (is_listening || is_receiving) {
            self.current_state = MascotState::SnrCritical;
        } else if doppler_shift_hz.abs() > 45.0 {
            self.current_state = MascotState::DopplerShift;
        } else if is_receiving {
            self.current_state = MascotState::BurstReceive;
        } else if is_listening {
            self.current_state = MascotState::ListenChirp;
        } else {
            self.current_state = MascotState::Standby;
        }

        // Pose kinematics
        match self.current_state {
            MascotState::Standby => {
                // Calm levitation at 0.5 Hz
                self.levitation_offset_y = (self.time_accum * std::f32::consts::PI).sin() * 5.0;
                self.head_tilt_deg = 0.0;
                self.body_lean_deg = 0.0;
                // Gaze tracks cursor
                let len = (cursor_rel_x * cursor_rel_x + cursor_rel_y * cursor_rel_y).sqrt().max(1.0);
                self.gaze_x = (cursor_rel_x / len) * 4.0;
                self.gaze_y = (cursor_rel_y / len) * 4.0;
                self.blink_factor = if (self.time_accum % 4.0) < 0.15 { 0.1 } else { 1.0 };
            }
            MascotState::ListenChirp => {
                self.levitation_offset_y = 0.0;
                self.head_tilt_deg = 45.0; // Inquisitive 45 degree acoustic tilt
                self.body_lean_deg = 5.0;
                self.gaze_x = 0.0;
                self.gaze_y = 0.0;
                self.blink_factor = 1.0; // Eyes wide open
            }
            MascotState::SnrCritical => {
                self.levitation_offset_y = (self.time_accum * 18.0).sin() * 2.0; // Jitter
                self.head_tilt_deg = -8.0;
                self.body_lean_deg = 0.0;
                // Anxious rapid blink
                self.blink_factor = if (self.time_accum * 6.0).fract() < 0.5 { 0.2 } else { 0.9 };
            }
            MascotState::DopplerShift => {
                self.levitation_offset_y = 0.0;
                self.head_tilt_deg = -12.0;
                // Lean into Doppler sound vector
                self.body_lean_deg = if doppler_shift_hz > 0.0 { -18.0 } else { 18.0 };
                self.gaze_x = if doppler_shift_hz > 0.0 { -5.0 } else { 5.0 };
                self.gaze_y = 0.0;
                self.blink_factor = 1.0;
            }
            MascotState::BurstReceive => {
                self.levitation_offset_y = -6.0;
                self.head_tilt_deg = 0.0;
                self.body_lean_deg = 0.0;
                self.gaze_x = 0.0;
                self.gaze_y = 0.0;
                self.blink_factor = 1.0;
            }
            MascotState::PacketConfirmed => {}
        }
    }

    pub fn get_face_label(&self) -> &'static str {
        match self.current_state {
            MascotState::Standby => "•ᴗ•",
            MascotState::ListenChirp => "⊙_⊙",
            MascotState::SnrCritical => ">_<",
            MascotState::DopplerShift => "•_~",
            MascotState::BurstReceive => "★_★",
            MascotState::PacketConfirmed => "^o^",
        }
    }

    pub fn get_state_title(&self) -> &'static str {
        match self.current_state {
            MascotState::Standby => "ACOUSTIC STANDBY",
            MascotState::ListenChirp => "SEARCHING CHIRP...",
            MascotState::SnrCritical => "SNR CRITICAL: NOISE DETECTED",
            MascotState::DopplerShift => "DOPPLER COMPENSATING",
            MascotState::BurstReceive => "RECEIVING BURST",
            MascotState::PacketConfirmed => "PACKET CONFIRMED!",
        }
    }
}
