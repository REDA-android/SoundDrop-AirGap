//! Page-Mascot Procedural Audio-Reactive Animation Machine
//! Controls dynamic facial expressions, head tilt, and low-SNR warnings.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MascotPose {
    IdleBreathing,
    ListeningFocused,
    SonicBurstEmitting,
    NoiseWarningEarsCovered,
    PacketCatchCelebration,
}

pub struct MascotController {
    current_pose: MascotPose,
    head_tilt_angle_deg: f32,
    ear_coverage_pct: f32,
}

impl MascotController {
    pub fn new() -> Self {
        Self {
            current_pose: MascotPose::IdleBreathing,
            head_tilt_angle_deg: 0.0,
            ear_coverage_pct: 0.0,
        }
    }

    /// Updates mascot emotional state based on acoustic metrics
    pub fn update(&mut self, snr_db: f32, is_transmitting: bool, is_listening: bool) -> MascotPose {
        if snr_db < 10.0 && (is_listening || is_transmitting) {
            self.current_pose = MascotPose::NoiseWarningEarsCovered;
            self.ear_coverage_pct = 1.0;
            self.head_tilt_angle_deg = -5.0;
        } else if is_transmitting {
            self.current_pose = MascotPose::SonicBurstEmitting;
            self.ear_coverage_pct = 0.0;
            self.head_tilt_angle_deg = 0.0;
        } else if is_listening {
            self.current_pose = MascotPose::ListeningFocused;
            self.ear_coverage_pct = 0.0;
            self.head_tilt_angle_deg = 8.5; // Inquisitive acoustic head tilt
        } else {
            self.current_pose = MascotPose::IdleBreathing;
            self.ear_coverage_pct = 0.0;
            self.head_tilt_angle_deg = 0.0;
        }

        self.current_pose
    }

    pub fn get_head_tilt(&self) -> f32 {
        self.head_tilt_angle_deg
    }
}
