//! Hairline 0.5px Sub-Pixel Geometry & Metalforge Anisotropic Material System
//! Targets HiDPI / Retina screens (scale factor S >= 2.0) with zero bilinear texture blur.
//!
//! Formulas:
//! - Hairline width: W_h = 1.0 / DPI_Scale_Factor = 0.5px (on 2x) or 0.333px (on 3x)
//! - Sub-pixel alignment: x_pixel = floor(x * S) + 0.5, y_pixel = floor(y * S) + 0.5
//! - Metalforge Bevel:
//!   - Zenithal reflection: Top 0.5px inner bevel at rgba(255, 255, 255, 0.18)
//!   - Etched shadow: Bottom 0.5px groove at rgba(0, 0, 0, 0.65)
//!   - Anisotropic noise: Procedural radial brushed metallic micro-scratch pattern

#[derive(Debug, Clone, Copy)]
pub struct SubPixelRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub hairline_width: f32,
}

#[derive(Debug, Clone, Copy)]
pub struct MetalforgeProfile {
    pub zenith_reflection_alpha: f32, // 0.18
    pub bottom_groove_alpha: f32,     // 0.65
    pub brushed_anisotropy_intensity: f32,
}

pub struct HairlineMetalforgeEngine {
    dpi_scale: f32,
    profile: MetalforgeProfile,
}

impl HairlineMetalforgeEngine {
    pub fn new(dpi_scale: f32) -> Self {
        let scale = if dpi_scale > 0.1 { dpi_scale } else { 2.0 };
        Self {
            dpi_scale: scale,
            profile: MetalforgeProfile {
                zenith_reflection_alpha: 0.18,
                bottom_groove_alpha: 0.65,
                brushed_anisotropy_intensity: 0.08,
            },
        }
    }

    /// Computes physical hairline stroke width W_h
    pub fn hairline_stroke_width(&self) -> f32 {
        1.0 / self.dpi_scale
    }

    /// Aligns coordinates to exact physical sub-pixel center (floor(coord * S) + 0.5)
    pub fn align_subpixel(&self, coord: f32) -> f32 {
        ((coord * self.dpi_scale).floor() + 0.5) / self.dpi_scale
    }

    /// Aligns rectangular quad to eliminate bilinear anti-aliasing fuzziness
    pub fn align_quad(&self, x: f32, y: f32, width: f32, height: f32) -> SubPixelRect {
        let aligned_x = self.align_subpixel(x);
        let aligned_y = self.align_subpixel(y);
        let aligned_w = (width * self.dpi_scale).round() / self.dpi_scale;
        let aligned_h = (height * self.dpi_scale).round() / self.dpi_scale;

        SubPixelRect {
            x: aligned_x,
            y: aligned_y,
            width: aligned_w,
            height: aligned_h,
            hairline_width: self.hairline_stroke_width(),
        }
    }

    /// Generates procedural anisotropic radial brushed titanium scratch factor at (x, y) relative to center
    pub fn sample_radial_anisotropy(&self, rel_x: f32, rel_y: f32) -> f32 {
        let radius = (rel_x * rel_x + rel_y * rel_y).sqrt();
        let angle = rel_y.atan2(rel_x);
        // High-frequency angular metallic brush ridges
        let ridge = (angle * 128.0).sin() * 0.5 + 0.5;
        // Radial damping
        let radial_falloff = (-radius * 0.01).exp();
        (ridge * radial_falloff) * self.profile.brushed_anisotropy_intensity
    }
}
