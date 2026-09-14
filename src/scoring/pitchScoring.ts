import { PITCH_THRESHOLDS } from '../config'
import type { EvaluatedFrame } from '../types/audio'

export type PitchStatus = 'Afinado' | 'Aceitável' | 'Desafinado' | 'Erro significativo'

export function scorePitchDifference(cents: number): number {
  const error = Math.abs(cents)
  if (error <= PITCH_THRESHOLDS.excellent) return 100
  if (error <= PITCH_THRESHOLDS.acceptable) return 100 - ((error - 20) / 20) * 20
  if (error <= PITCH_THRESHOLDS.outOfTune) return 80 - ((error - 40) / 30) * 40
  return Math.max(0, 40 - ((error - 70) / 130) * 40)
}

export function pitchStatus(cents: number): PitchStatus {
  const error = Math.abs(cents)
  if (error <= PITCH_THRESHOLDS.excellent) return 'Afinado'
  if (error <= PITCH_THRESHOLDS.acceptable) return 'Aceitável'
  if (error <= PITCH_THRESHOLDS.outOfTune) return 'Desafinado'
  return 'Erro significativo'
}

export const pitchScore = (frames: EvaluatedFrame[]) => frames.length ? frames.reduce((sum, frame) => sum + scorePitchDifference(frame.differenceCents), 0) / frames.length : 0
