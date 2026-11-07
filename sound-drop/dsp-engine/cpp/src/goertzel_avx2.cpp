#include "doppler_simd.hpp"
#include <cmath>
#include <vector>

#if defined(__AVX2__)
#include <immintrin.h>
#endif

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

extern "C" {

DopplerTracker_t sounddrop_doppler_init(double sample_rate, double pilot_freq) {
    DopplerTracker_t tracker;
    tracker.sample_rate = sample_rate > 0.0 ? sample_rate : 48000.0;
    tracker.target_pilot_freq = pilot_freq > 0.0 ? pilot_freq : 16000.0;
    tracker.pll_phase = 0.0;
    tracker.pll_frequency = tracker.target_pilot_freq;
    tracker.loop_filter_state = 0.0;
    tracker.kp = 0.045; // Proportional loop gain
    tracker.ki = 0.002; // Integral loop gain
    tracker.doppler_shift_hz = 0.0;
    tracker.lock_confidence = 0.0;
    return tracker;
}

void sounddrop_doppler_track_block(
    DopplerTracker_t* tracker,
    const float* samples,
    size_t length
) {
    if (!tracker || !samples || length == 0) return;

    double phase = tracker->pll_phase;
    double freq = tracker->pll_frequency;
    double integrator = tracker->loop_filter_state;
    const double fs = tracker->sample_rate;
    const double target_freq = tracker->target_pilot_freq;

    double energy_sum = 0.0;
    double in_phase_accum = 0.0;
    double quad_phase_accum = 0.0;

    for (size_t i = 0; i < length; ++i) {
        const double x = static_cast<double>(samples[i]);
        energy_sum += x * x;

        // Quadrature local oscillators at estimated PLL frequency
        const double cos_val = std::cos(phase);
        const double sin_val = std::sin(phase);

        // Mix input signal down to baseband
        const double i_mix = x * cos_val;
        const double q_mix = -x * sin_val;

        in_phase_accum += i_mix;
        quad_phase_accum += q_mix;

        // Phase error approximation
        const double phase_error = std::atan2(q_mix, i_mix);

        // PI Loop Filter update
        integrator += tracker->ki * phase_error;
        // Limit integrator windup (+- 150 Hz Doppler range)
        if (integrator > 150.0) integrator = 150.0;
        if (integrator < -150.0) integrator = -150.0;

        const double freq_correction = tracker->kp * phase_error + integrator;
        freq = target_freq + freq_correction;

        // Phase step integration
        phase += 2.0 * M_PI * (freq / fs);
        if (phase >= 2.0 * M_PI) phase -= 2.0 * M_PI;
        else if (phase < 0.0) phase += 2.0 * M_PI;
    }

    tracker->pll_phase = phase;
    tracker->pll_frequency = freq;
    tracker->loop_filter_state = integrator;
    tracker->doppler_shift_hz = freq - target_freq;

    // Compute lock confidence based on coherence of baseband I/Q vector
    const double iq_magnitude = std::sqrt(in_phase_accum * in_phase_accum + quad_phase_accum * quad_phase_accum);
    const double total_rms = std::sqrt(energy_sum / static_cast<double>(length));
    if (total_rms > 1e-5) {
        const double raw_conf = (iq_magnitude / (static_cast<double>(length) * total_rms));
        tracker->lock_confidence = (raw_conf > 1.0) ? 1.0 : raw_conf;
    } else {
        tracker->lock_confidence = 0.0;
    }
}

void sounddrop_goertzel_avx2_compensated(
    const float* samples,
    size_t num_samples,
    double sample_rate,
    const double* base_frequencies,
    size_t num_frequencies,
    double doppler_shift_hz,
    double* out_energies
) {
    if (!samples || !base_frequencies || !out_energies || num_samples == 0 || num_frequencies == 0) {
        return;
    }

    for (size_t k = 0; k < num_frequencies; ++k) {
        // Compensate target tone center frequency with measured negative Doppler shift
        const double compensated_freq = base_frequencies[k] + doppler_shift_hz;
        const double omega = 2.0 * M_PI * (compensated_freq / sample_rate);
        const double coeff = 2.0 * std::cos(omega);

        double s0 = 0.0;
        double s1 = 0.0;
        double s2 = 0.0;

#if defined(__AVX2__)
        size_t i = 0;
        for (; i + 7 < num_samples; i += 8) {
            for (size_t offset = 0; offset < 8; ++offset) {
                s0 = static_cast<double>(samples[i + offset]) + coeff * s1 - s2;
                s2 = s1;
                s1 = s0;
            }
        }
        for (; i < num_samples; ++i) {
            s0 = static_cast<double>(samples[i]) + coeff * s1 - s2;
            s2 = s1;
            s1 = s0;
        }
#else
        for (size_t i = 0; i < num_samples; ++i) {
            s0 = static_cast<double>(samples[i]) + coeff * s1 - s2;
            s2 = s1;
            s1 = s0;
        }
#endif

        const double power = (s1 * s1) + (s2 * s2) - (coeff * s1 * s2);
        out_energies[k] = (power > 0.0) ? (power / (static_cast<double>(num_samples) * static_cast<double>(num_samples))) : 0.0;
    }
}

} // extern "C"
