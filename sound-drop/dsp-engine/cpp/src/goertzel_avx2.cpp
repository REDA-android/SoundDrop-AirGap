#include "doppler_simd.hpp"
#include <cmath>
#include <vector>
#include <cstring>

#if defined(__AVX2__)
#include <immintrin.h>
#elif defined(__ARM_NEON) || defined(__ARM_NEON__)
#include <arm_neon.h>
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

        // Phase error approximation: atan2(Q, I)
        const double phase_error = std::atan2(q_mix, i_mix);

        // PI Loop Filter update
        integrator += tracker->ki * phase_error;
        // Anti-windup clamping (+- 150 Hz Doppler range)
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

    // Lock confidence based on coherence of baseband I/Q vector
    const double iq_magnitude = std::sqrt(in_phase_accum * in_phase_accum + quad_phase_accum * quad_phase_accum);
    const double total_rms = std::sqrt(energy_sum / static_cast<double>(length));
    if (total_rms > 1e-5) {
        const double raw_conf = (iq_magnitude / (static_cast<double>(length) * total_rms));
        tracker->lock_confidence = (raw_conf > 1.0) ? 1.0 : raw_conf;
    } else {
        tracker->lock_confidence = 0.0;
    }
}

/**
 * AVX2 / NEON Vectorized Goertzel Filter Bank
 * Evaluates 8 tone channels simultaneously using 256-bit SIMD registers.
 * Difference equation: s[n] = x[n] + 2*cos(omega)*s[n-1] - s[n-2]
 * Vector FMA: s_curr = _mm256_fmadd_ps(v_coeff, s_prev1, _mm256_sub_ps(v_x, s_prev2))
 */
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

    // Process frequencies in chunks of 8 (SIMD AVX2 width for float32)
    size_t k = 0;

#if defined(__AVX2__)
    for (; k + 7 < num_frequencies; k += 8) {
        float coeff_arr[8];
        for (int i = 0; i < 8; ++i) {
            double compensated_freq = base_frequencies[k + i] + doppler_shift_hz;
            double omega = 2.0 * M_PI * (compensated_freq / sample_rate);
            coeff_arr[i] = static_cast<float>(2.0 * std::cos(omega));
        }

        __m256 v_coeff = _mm256_loadu_ps(coeff_arr);
        __m256 s_prev1 = _mm256_setzero_ps();
        __m256 s_prev2 = _mm256_setzero_ps();

        for (size_t n = 0; n < num_samples; ++n) {
            __m256 v_x = _mm256_set1_ps(samples[n]);
            // s_curr = v_coeff * s_prev1 + (v_x - s_prev2)
            __m256 s_curr = _mm256_fmadd_ps(v_coeff, s_prev1, _mm256_sub_ps(v_x, s_prev2));
            s_prev2 = s_prev1;
            s_prev1 = s_curr;
        }

        // Final energy: |X(f_k)|^2 = s_prev1^2 + s_prev2^2 - v_coeff * s_prev1 * s_prev2
        __m256 s1_sq = _mm256_mul_ps(s_prev1, s_prev1);
        __m256 s2_sq = _mm256_mul_ps(s_prev2, s_prev2);
        __m256 cross = _mm256_mul_ps(v_coeff, _mm256_mul_ps(s_prev1, s_prev2));
        __m256 energy = _mm256_sub_ps(_mm256_add_ps(s1_sq, s2_sq), cross);

        float energy_arr[8];
        _mm256_storeu_ps(energy_arr, energy);

        double norm = static_cast<double>(num_samples) * static_cast<double>(num_samples);
        for (int i = 0; i < 8; ++i) {
            double p = static_cast<double>(energy_arr[i]);
            out_energies[k + i] = (p > 0.0) ? (p / norm) : 0.0;
        }
    }
#elif (defined(__ARM_NEON) || defined(__ARM_NEON__))
    for (; k + 3 < num_frequencies; k += 4) {
        float coeff_arr[4];
        for (int i = 0; i < 4; ++i) {
            double compensated_freq = base_frequencies[k + i] + doppler_shift_hz;
            double omega = 2.0 * M_PI * (compensated_freq / sample_rate);
            coeff_arr[i] = static_cast<float>(2.0 * std::cos(omega));
        }

        float32x4_t v_coeff = vld1q_f32(coeff_arr);
        float32x4_t s_prev1 = vdupq_n_f32(0.0f);
        float32x4_t s_prev2 = vdupq_n_f32(0.0f);

        for (size_t n = 0; n < num_samples; ++n) {
            float32x4_t v_x = vdupq_n_f32(samples[n]);
            // s_curr = (v_x - s_prev2) + v_coeff * s_prev1
            float32x4_t s_curr = vfmaq_f32(vsubq_f32(v_x, s_prev2), v_coeff, s_prev1);
            s_prev2 = s_prev1;
            s_prev1 = s_curr;
        }

        float32x4_t s1_sq = vmulq_f32(s_prev1, s_prev1);
        float32x4_t s2_sq = vmulq_f32(s_prev2, s_prev2);
        float32x4_t cross = vmulq_f32(v_coeff, vmulq_f32(s_prev1, s_prev2));
        float32x4_t energy = vsubq_f32(vaddq_f32(s1_sq, s2_sq), cross);

        float energy_arr[4];
        vst1q_f32(energy_arr, energy);

        double norm = static_cast<double>(num_samples) * static_cast<double>(num_samples);
        for (int i = 0; i < 4; ++i) {
            double p = static_cast<double>(energy_arr[i]);
            out_energies[k + i] = (p > 0.0) ? (p / norm) : 0.0;
        }
    }
#endif

    // Scalar fallback for remaining frequencies or non-SIMD architectures
    for (; k < num_frequencies; ++k) {
        const double compensated_freq = base_frequencies[k] + doppler_shift_hz;
        const double omega = 2.0 * M_PI * (compensated_freq / sample_rate);
        const double coeff = 2.0 * std::cos(omega);

        double s0 = 0.0;
        double s1 = 0.0;
        double s2 = 0.0;

        for (size_t i = 0; i < num_samples; ++i) {
            s0 = static_cast<double>(samples[i]) + coeff * s1 - s2;
            s2 = s1;
            s1 = s0;
        }

        const double power = (s1 * s1) + (s2 * s2) - (coeff * s1 * s2);
        out_energies[k] = (power > 0.0) ? (power / (static_cast<double>(num_samples) * static_cast<double>(num_samples))) : 0.0;
    }
}

} // extern "C"
