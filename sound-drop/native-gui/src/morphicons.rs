//! Morphicons: Seamless Vector Icon Morphing Engine (Constant N = 64 Bezier Points)
//! Eliminates icon replacement popping with continuous Hermite sigmoid morphing:
//!
//! Formulas:
//! - Hermite Sigmoid Easing: sigma(t) = 3*t^2 - 2*t^3, for t in [0, 1]
//! - Control Point Path: P_i(t) = (1 - sigma(t)) * P_i_start + sigma(t) * P_i_end

pub const CONTROL_POINT_COUNT: usize = 64;

#[derive(Debug, Clone, Copy)]
pub struct VectorPoint2D {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IconShape {
    RadarCircle,
    FileRectangle,
    EncryptedKey,
    ValidationCheckmark,
}

pub struct MorphiconEngine {
    current_shape: IconShape,
    target_shape: IconShape,
    morph_progress: f32, // 0.0 -> 1.0
    radar_points: [VectorPoint2D; CONTROL_POINT_COUNT],
    file_points: [VectorPoint2D; CONTROL_POINT_COUNT],
    key_points: [VectorPoint2D; CONTROL_POINT_COUNT],
    check_points: [VectorPoint2D; CONTROL_POINT_COUNT],
}

impl MorphiconEngine {
    pub fn new() -> Self {
        let mut radar = [VectorPoint2D { x: 0.0, y: 0.0 }; CONTROL_POINT_COUNT];
        let mut file = [VectorPoint2D { x: 0.0, y: 0.0 }; CONTROL_POINT_COUNT];
        let mut key = [VectorPoint2D { x: 0.0, y: 0.0 }; CONTROL_POINT_COUNT];
        let mut check = [VectorPoint2D { x: 0.0, y: 0.0 }; CONTROL_POINT_COUNT];

        // 1. Radar Circle (Radius 24.0 centered at 0, 0)
        for i in 0..CONTROL_POINT_COUNT {
            let theta = (i as f32) * (2.0 * std::f32::consts::PI / CONTROL_POINT_COUNT as f32);
            radar[i] = VectorPoint2D {
                x: theta.cos() * 24.0,
                y: theta.sin() * 24.0,
            };
        }

        // 2. Rectangular File (Width 36.0, Height 48.0 centered at 0, 0)
        let per_side = CONTROL_POINT_COUNT / 4; // 16 points per side
        for i in 0..CONTROL_POINT_COUNT {
            let side = i / per_side;
            let frac = (i % per_side) as f32 / per_side as f32;
            let pt = match side {
                0 => VectorPoint2D { x: -18.0 + frac * 36.0, y: -24.0 }, // Top
                1 => VectorPoint2D { x: 18.0, y: -24.0 + frac * 48.0 },  // Right
                2 => VectorPoint2D { x: 18.0 - frac * 36.0, y: 24.0 },   // Bottom
                _ => VectorPoint2D { x: -18.0, y: 24.0 - frac * 48.0 },  // Left
            };
            file[i] = pt;
        }

        // 3. Encrypted Key / Lock
        for i in 0..CONTROL_POINT_COUNT {
            if i < 32 {
                // Top shackle loop
                let theta = (i as f32) * (std::f32::consts::PI / 32.0);
                key[i] = VectorPoint2D {
                    x: theta.cos() * 12.0,
                    y: -14.0 - theta.sin() * 12.0,
                };
            } else {
                // Bottom padlock body
                let idx = i - 32;
                let theta = (idx as f32) * (2.0 * std::f32::consts::PI / 32.0);
                key[i] = VectorPoint2D {
                    x: theta.cos() * 18.0,
                    y: 8.0 + theta.sin() * 14.0,
                };
            }
        }

        // 4. Validation Checkmark
        for i in 0..CONTROL_POINT_COUNT {
            if i < 24 {
                // Downward stroke: (-18, 0) -> (-6, 14)
                let frac = i as f32 / 24.0;
                check[i] = VectorPoint2D {
                    x: -18.0 + frac * 12.0,
                    y: frac * 14.0,
                };
            } else {
                // Upward flourish stroke: (-6, 14) -> (18, -16)
                let frac = (i - 24) as f32 / 40.0;
                check[i] = VectorPoint2D {
                    x: -6.0 + frac * 24.0,
                    y: 14.0 - frac * 30.0,
                };
            }
        }

        Self {
            current_shape: IconShape::RadarCircle,
            target_shape: IconShape::RadarCircle,
            morph_progress: 1.0,
            radar_points: radar,
            file_points: file,
            key_points: key,
            check_points: check,
        }
    }

    pub fn morph_to(&mut self, next: IconShape) {
        if self.target_shape != next {
            self.current_shape = self.target_shape;
            self.target_shape = next;
            self.morph_progress = 0.0;
        }
    }

    /// Advances morph progress over dt (duration: 320ms)
    pub fn update(&mut self, dt: f32) {
        if self.morph_progress < 1.0 {
            self.morph_progress = (self.morph_progress + (dt / 0.320)).min(1.0);
        }
    }

    /// Hermite Sigmoid Easing: sigma(t) = 3*t^2 - 2*t^3
    pub fn hermite_sigmoid(t: f32) -> f32 {
        let clamped = t.clamp(0.0, 1.0);
        (3.0 * clamped * clamped) - (2.0 * clamped * clamped * clamped)
    }

    fn get_points(&self, shape: IconShape) -> &[VectorPoint2D; CONTROL_POINT_COUNT] {
        match shape {
            IconShape::RadarCircle => &self.radar_points,
            IconShape::FileRectangle => &self.file_points,
            IconShape::EncryptedKey => &self.key_points,
            IconShape::ValidationCheckmark => &self.check_points,
        }
    }

    /// Evaluates all 64 continuous Bezier points for the current frame
    pub fn evaluate_current_frame(&self) -> [VectorPoint2D; CONTROL_POINT_COUNT] {
        let p_start = self.get_points(self.current_shape);
        let p_end = self.get_points(self.target_shape);
        let sigma = Self::hermite_sigmoid(self.morph_progress);

        let mut out = [VectorPoint2D { x: 0.0, y: 0.0 }; CONTROL_POINT_COUNT];
        for i in 0..CONTROL_POINT_COUNT {
            out[i] = VectorPoint2D {
                x: (1.0 - sigma) * p_start[i].x + sigma * p_end[i].x,
                y: (1.0 - sigma) * p_start[i].y + sigma * p_end[i].y,
            };
        }
        out
    }
}
