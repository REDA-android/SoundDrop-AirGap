#ifndef DOPPLER_SIMD_HPP
#define DOPPLER_SIMD_HPP

#include <cstddef>
#include <cstdint>

#ifdef __cplusplus
extern "C" {
#endif

// Pilot Tone & Doppler Tracking State
typedef struct {
    double sample_rate;             // Typically 48000.0 Hz
    double target_pilot_freq;       // Exact pilot tone frequency: 16000.0 Hz
    double pll_phase;               // Current PLL phase accumulator
    double pll_frequency;           // Estimated tracked frequency
    double loop_filter_state;       // Proportional-Integral (PI) filter integrator
    double kp;                      // Proportional gain (e.g. 0.05)
    double ki;                      // Integral gain (e.g. 0.002)
    double doppler_shift_hz;        // Computed frequency shift Delta_f = (pll_freq - target)
    double lock_confidence;         // 0.0 to 1.0 lock metric
} DopplerTracker_t;

// Vectorized Goertzel Detection Output
typedef struct {
    double peak_energy;
    double noise_floor;
    double snr_db;
    int detected_symbol;            // 0..15 or -1 if no tone above threshold
} SimdDetection_t;

// Doppler Tracker Initializer & Step Function
DopplerTracker_t sounddrop_doppler_init(double sample_rate, double pilot_freq);
void sounddrop_doppler_track_block(
    DopplerTracker_t* tracker,
    const float* samples,
    size_t length
);

// AVX2 SIMD Vectorized Goertzel Bank with Doppler Offset Compensation
void sounddrop_goertzel_avx2_compensated(
    const float* samples,
    size_t num_samples,
    double sample_rate,
    const double* base_frequencies,
    size_t num_frequencies,
    double doppler_shift_hz,
    double* out_energies
);

// Psychoacoustic Masking Envelope Synthesizer
void sounddrop_apply_psycho_masking(
    const float* raw_carrier,
    const float* masking_envelope,
    float* out_masked_signal,
    size_t length,
    float masking_threshold_ratio
);

#ifdef __cplusplus
}
#endif

#endif // DOPPLER_SIMD_HPP
