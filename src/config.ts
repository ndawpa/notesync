export const AUDIO_CONFIG = {
  fftSize: 4096,
  minFrequency: 75,
  maxFrequency: 1100,
  yinThreshold: 0.15,
  minConfidence: 0.7,
  minRms: 0.012,
  smoothingWindowMs: 120,
} as const

export const PITCH_THRESHOLDS = { excellent: 20, acceptable: 40, outOfTune: 70 } as const
export const RHYTHM_THRESHOLDS_MS = { excellent: 100, good: 200, acceptable: 350 } as const
