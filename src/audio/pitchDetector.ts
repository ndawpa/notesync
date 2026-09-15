import { AUDIO_CONFIG } from '../config'
import type { PitchDetection } from '../types/audio'

export function rootMeanSquare(samples: Float32Array): number {
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / samples.length)
}

export function detectPitchYin(samples: Float32Array, sampleRate: number, minRms: number = AUDIO_CONFIG.minRms): PitchDetection | null {
  const volume = rootMeanSquare(samples)
  if (volume < minRms) return null

  const minLag = Math.max(2, Math.floor(sampleRate / AUDIO_CONFIG.maxFrequency))
  const maxLag = Math.min(Math.floor(sampleRate / AUDIO_CONFIG.minFrequency), Math.floor(samples.length / 2))
  const difference = new Float32Array(maxLag + 1)
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0
    for (let index = 0; index < samples.length - lag; index++) {
      const delta = samples[index] - samples[index + lag]
      sum += delta * delta
    }
    difference[lag] = sum
  }

  const cumulative = new Float32Array(maxLag + 1)
  cumulative[0] = 1
  let runningSum = 0
  for (let lag = 1; lag <= maxLag; lag++) {
    runningSum += difference[lag]
    cumulative[lag] = runningSum === 0 ? 1 : (difference[lag] * lag) / runningSum
  }

  let bestLag = -1
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (cumulative[lag] < AUDIO_CONFIG.yinThreshold) {
      while (lag + 1 <= maxLag && cumulative[lag + 1] < cumulative[lag]) lag++
      bestLag = lag
      break
    }
  }
  if (bestLag < 0) return null

  const left = cumulative[bestLag - 1] ?? cumulative[bestLag]
  const center = cumulative[bestLag]
  const right = cumulative[bestLag + 1] ?? center
  const divisor = 2 * (2 * center - right - left)
  const refinedLag = divisor === 0 ? bestLag : bestLag + (right - left) / divisor
  const confidence = Math.max(0, Math.min(1, 1 - center))
  if (confidence < AUDIO_CONFIG.minConfidence) return null
  return { frequency: sampleRate / refinedLag, confidence, volume }
}

export function medianFrequency(history: Array<{ frequency: number; timestamp: number }>, now: number): number {
  const recent = history.filter((item) => now - item.timestamp <= AUDIO_CONFIG.smoothingWindowMs / 1000).map((item) => item.frequency).sort((a, b) => a - b)
  if (!recent.length) return 0
  const middle = Math.floor(recent.length / 2)
  return recent.length % 2 ? recent[middle] : (recent[middle - 1] + recent[middle]) / 2
}
