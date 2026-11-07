//! Metallic Bubble Micro-Physics & Non-Linear Damped Harmonic Spring Engine
//! (Affect UI + React Bits Micro)
//!
//! Differential Equation:
//! m * (d^2 x / dt^2) + c * (dx / dt) + k * (x - x_target) = F_acoustic(t)
//!
//! Physical Parameters:
//! - Mass (m): 1.0 kg (perceived bubble inertia)
//! - Spring Stiffness (k): 240.0 N/m (rebound crispness)
//! - Damping Coefficient (c): 18.5 N*s/m (oscillation suppression)
//! - Acoustic Forcing (F): instant acoustic energy in 1.6 - 20.5 kHz band
//!
//! Tactile Dynamics:
//! - Hover / Approach: magnetic levitation vector tilting toward pointer
//! - Hold-to-Emit: mechanical contraction to scale 0.91 with concentric micro-rings escaping
//! - Explosive Release: acoustic shockwave + elastic non-linear frame-by-frame bounce

pub struct MetallicBubblePhysics {
    pub mass: f32,
    pub stiffness: f32,
    pub damping: f32,

    // Dynamic state
    pub scale: f32,
    pub scale_velocity: f32,
    pub target_scale: f32,

    // Positional displacement (magnetic levitation)
    pub offset_x: f32,
    pub offset_y: f32,
    pub vel_x: f32,
    pub vel_y: f32,

    pub is_held: bool,
    pub concentric_rings: Vec<f32>, // Expansion radii of escaping micro-rings
}

impl MetallicBubblePhysics {
    pub fn new() -> Self {
        Self {
            mass: 1.0,
            stiffness: 240.0,
            damping: 18.5,
            scale: 1.0,
            scale_velocity: 0.0,
            target_scale: 1.0,
            offset_x: 0.0,
            offset_y: 0.0,
            vel_x: 0.0,
            vel_y: 0.0,
            is_held: false,
            concentric_rings: Vec::with_capacity(8),
        }
    }

    /// User cursor hover: calculates magnetic levitation pull towards cursor (cx, cy)
    pub fn handle_cursor_approach(&mut self, cursor_x: f32, cursor_y: f32, center_x: f32, center_y: f32) {
        let dx = cursor_x - center_x;
        let dy = cursor_y - center_y;
        let dist = (dx * dx + dy * dy).sqrt();

        if dist < 180.0 && dist > 1.0 {
            // Magnetic tilt: max 12px displacement
            let pull = (1.0 - (dist / 180.0)).powi(2) * 12.0;
            self.offset_x = (dx / dist) * pull;
            self.offset_y = (dy / dist) * pull;
        } else {
            self.offset_x = 0.0;
            self.offset_y = 0.0;
        }
    }

    /// Press / Hold-to-Emit: contracts bubble to scale 0.91
    pub fn on_press(&mut self) {
        self.is_held = true;
        self.target_scale = 0.91;
    }

    /// Explosive Release: trigger shockwave burst and elastic snap-back
    pub fn on_release(&mut self) {
        self.is_held = false;
        self.target_scale = 1.0;
        self.scale_velocity = 2.4; // Initial positive burst velocity for elastic bounce
        self.concentric_rings.push(1.0); // Spawn initial micro-ring shockwave
    }

    /// Step the physical oscillator by dt seconds using acoustic forcing F(t)
    pub fn step(&mut self, dt: f32, f_acoustic: f32) {
        let dt_clamped = dt.clamp(0.001, 0.033);

        // Scale Oscillator: m * a + c * v + k * (x - target) = F
        let displacement = self.scale - self.target_scale;
        let spring_force = -self.stiffness * displacement;
        let damping_force = -self.damping * self.scale_velocity;
        let acoustic_kick = f_acoustic * 15.0; // Acoustic pressure modulation

        let net_force = spring_force + damping_force + acoustic_kick;
        let acceleration = net_force / self.mass;

        self.scale_velocity += acceleration * dt_clamped;
        self.scale += self.scale_velocity * dt_clamped;

        // Prevent physically impossible inversion
        if self.scale < 0.6 {
            self.scale = 0.6;
            self.scale_velocity = 0.0;
        }

        // Advance concentric escaping rings
        let mut i = 0;
        while i < self.concentric_rings.len() {
            self.concentric_rings[i] += 120.0 * dt_clamped;
            if self.concentric_rings[i] > 180.0 {
                self.concentric_rings.remove(i);
            } else {
                i += 1;
            }
        }

        // Spawn periodic escaping micro-rings while held
        if self.is_held && (self.concentric_rings.is_empty() || self.concentric_rings.last().copied().unwrap_or(0.0) > 35.0) {
            self.concentric_rings.push(1.0);
        }
    }
}
