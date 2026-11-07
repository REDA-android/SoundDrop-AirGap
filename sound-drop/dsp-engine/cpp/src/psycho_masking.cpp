#include "doppler_simd.hpp"
#include <cmath>
#include <algorithm>

extern "C" {

/**
 * Calculates simplified psychoacoustic masking curve (Bark scale threshold)
 * Bark scale: z = 13 * atan(0.00076 * f) + 3.5 * atan((f / 7500)^2)
 */
static double frequency_to_bark(double freq_hz) {
    const double f_khz = freq_hz / 1000.0;
    return 13.0 * std::atan(0.76 * f_khz) + 3.5 * std::atan((f_khz / 7.5) * (f_khz / 7.5));
}

void sounddrop_apply_psycho_masking(
    const float* raw_carrier,
    const float* masking_envelope,
    float* out_masked_signal,
    size_t length,
    float masking_threshold_ratio
) {
    if (!raw_carrier || !out_masked_signal || length == 0) return;

    // Default ratio: carrier energy kept 12dB to 18dB beneath audible masking envelope
    const float ratio = (masking_threshold_ratio > 0.0f) ? masking_threshold_ratio : 0.18f;

    for (size_t i = 0; i < length; ++i) {
        const float carrier_sample = raw_carrier[i];
        const float envelope_sample = masking_envelope ? masking_envelope[i] : 0.0f;

        // Sub-carrier is shaped and embedded beneath masking acoustic texture
        const float masked_carrier = carrier_sample * ratio;
        out_masked_signal[i] = envelope_sample + masked_carrier;
    }
}

} // extern "C"
