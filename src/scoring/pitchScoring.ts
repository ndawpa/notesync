import { PITCH_THRESHOLDS } from '../config'
import type { EvaluatedFrame } from '../types/audio'
import type { ReferenceTrack } from '../types/music'

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

export function representativeCents(frames: EvaluatedFrame[]): number {
  const values = frames.map((frame) => frame.differenceCents).sort((a, b) => a - b)
  const middle = Math.floor(values.length / 2)
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2
}

export function pitchScore(track: ReferenceTrack, frames: EvaluatedFrame[]): number {
  if (!track.notes.length) return 0
  const total = track.notes.reduce((sum, note) => {
    const matches = frames.filter((frame) => frame.expectedNoteId === note.id)
    return sum + (matches.length ? scorePitchDifference(representativeCents(matches)) : 0)
  }, 0)
  return total / track.notes.length
}
