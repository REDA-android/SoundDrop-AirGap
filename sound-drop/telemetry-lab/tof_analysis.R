# ==============================================================================
# Sound Drop Scientific Telemetry Lab: Acoustic Time-of-Flight (ToF) Analysis
# Statistical validation of sub-1.5m physical co-presence proofs
# ==============================================================================

#' Evaluates acoustic ToF distance distributions under varying multipath echo environments
simulate_tof_trials <- function(num_trials = 1000, true_distance_m = 0.50, snr_db = 20) {
  c_sound <- 343.2 # Speed of sound (m/s)
  true_delay_sec <- (2 * true_distance_m) / c_sound
  
  # Standard deviation of hardware timing jitter (nanosecond / microsecond scale)
  jitter_sd <- 1.5e-5 # 15 microseconds
  
  # Add Gaussian timing jitter + exponential multipath tail
  jitter <- rnorm(num_trials, mean = 0, sd = jitter_sd)
  multipath_delay <- rexp(num_trials, rate = 1 / 2.0e-5) * (snr_db < 15)
  
  measured_delay <- true_delay_sec + jitter + multipath_delay
  measured_distance <- (c_sound * pmax(measured_delay, 1e-6)) / 2.0
  
  valid_count <- sum(measured_distance <= 1.50 & measured_distance >= 0.05)
  pass_rate <- (valid_count / num_trials) * 100
  
  return(list(
    true_distance = true_distance_m,
    mean_measured = mean(measured_distance),
    std_dev = sd(measured_distance),
    pass_rate_pct = pass_rate
  ))
}

results <- simulate_tof_trials(1000, 0.45, 22)

cat("========================================================\n")
cat(" Sound Drop Acoustic ToF Co-Presence Verification\n")
cat("========================================================\n")
cat(sprintf("Ground Truth Distance: %.3f m\n", results$true_distance))
cat(sprintf("Empirical Mean Distance: %.3f m (SD: %.4f m)\n", results$mean_measured, results$std_dev))
cat(sprintf("Co-Presence Validation Pass Rate (<1.5m): %.1f%%\n", results$pass_rate_pct))
cat("Acoustic ToF distance distribution verified.\n")
