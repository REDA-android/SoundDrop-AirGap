//! Hairline 0.5px Radar Geometry & Node Positioning Math

#[derive(Debug, Clone)]
pub struct RadarPoint {
    pub x: f32,
    pub y: f32,
    pub radius: f32,
    pub snr_db: f32,
    pub label: String,
}

pub struct RadarRenderer {
    center_x: f32,
    center_y: f32,
}

impl RadarRenderer {
    pub fn new(center_x: f32, center_y: f32) -> Self {
        Self { center_x, center_y }
    }

    /// Computes radial coordinates for discovered acoustic peer nodes
    pub fn calculate_peer_position(&self, index: usize, total_nodes: usize, distance_rssi: f32) -> RadarPoint {
        if total_nodes == 0 {
            return RadarPoint {
                x: self.center_x,
                y: self.center_y,
                radius: 44.0,
                snr_db: 20.0,
                label: "Center".to_string(),
            };
        }

        let angle = (index as f32) * (2.0 * std::f32::consts::PI / total_nodes as f32) - (std::f32::consts::PI / 2.0);
        let base_distance = 150.0 + (distance_rssi * 0.4);

        let x = self.center_x + base_distance * angle.cos();
        let y = self.center_y + base_distance * angle.sin();

        RadarPoint {
            x,
            y,
            radius: 46.0,
            snr_db: 22.0,
            label: format!("Node #{}", index + 1),
        }
    }
}
