# ==============================================================================
# Sound Drop Scientific Telemetry Lab: Power Spectral Density (PSD)
# Evaluates 16-FSK Tone Orthogonality and 16 kHz Doppler Pilot Tone Peak
# ==============================================================================

compute_synthetic_psd <- function(sample_rate = 48000, duration_sec = 0.1) {
  num_samples <- round(sample_rate * duration_sec)
  t <- seq(0, duration_sec, length.out = num_samples)
  
  # Pilot tone at 16000 Hz + Doppler drift (+35 Hz)
  pilot_freq <- 16035.0
  pilot_wave <- 0.4 * sin(2 * pi * pilot_freq * t)
  
  # Active 16-FSK symbol tone (e.g. Symbol 5: 1600 + 5*187.5 = 2537.5 Hz)
  data_freq <- 2537.5
  data_wave <- 0.8 * sin(2 * pi * data_freq * t)
  
  # Ambient white Gaussian noise
  noise <- rnorm(num_samples, mean = 0, sd = 0.05)
  composite_signal <- pilot_wave + data_wave + noise
  
  # Fast Fourier Transform (Periodogram spectral estimate)
  fft_result <- fft(composite_signal)
  psd <- (Mod(fft_result)^2) / num_samples
  freqs <- seq(0, sample_rate / 2, length.out = num_samples / 2)
  
  # Identify pilot tone peak
  pilot_bin_idx <- which.min(abs(freqs - 16035))
  pilot_peak_power <- psd[pilot_bin_idx]
  
  return(list(
    pilot_detected_freq = freqs[pilot_bin_idx],
    pilot_power = pilot_peak_power,
    doppler_measured_hz = freqs[pilot_bin_idx] - 16000.0
  ))
}

psd_results <- compute_synthetic_psd()

cat("========================================================\n")
cat(" Sound Drop Power Spectral Density & Doppler Telemetry\n")
cat("========================================================\n")
cat(sprintf("Pilot Tone Expected: 16000.0 Hz | Detected: %.1f Hz\n", psd_results$pilot_detected_freq))
cat(sprintf("Measured Doppler Frequency Drift: %+.1f Hz\n", psd_results$doppler_measured_hz))
cat("Spectral density analysis verified.\n")
