import { RHYTHM_THRESHOLDS_MS } from '../config'
import type { EvaluatedFrame } from '../types/audio'
import type { ReferenceTrack } from '../types/music'

export interface NoteTiming { noteId: string; onsetErrorMs: number; durationErrorMs: number }

const timingScore = (errorMs: number) => {
  const error = Math.abs(errorMs)
  if (error <= RHYTHM_THRESHOLDS_MS.excellent) return 100
  if (error <= RHYTHM_THRESHOLDS_MS.good) return 85
  if (error <= RHYTHM_THRESHOLDS_MS.acceptable) return 65
  return Math.max(0, 50 - (error - 350) / 10)
}

export function evaluateTimings(track: ReferenceTrack, frames: EvaluatedFrame[]): NoteTiming[] {
  return track.notes.flatMap((note) => {
    const matches = frames.filter((frame) => frame.expectedNoteId === note.id)
    if (!matches.length) return []
    const first = matches[0].timestamp
    const last = matches[matches.length - 1].timestamp
    return [{ noteId: note.id, onsetErrorMs: (first - note.start) * 1000, durationErrorMs: ((last - first) - note.duration) * 1000 }]
  })
}

export function rhythmScore(track: ReferenceTrack, frames: EvaluatedFrame[]): number {
  const timings = evaluateTimings(track, frames)
  if (!timings.length) return 0
  return timings.reduce((sum, timing) => sum + timingScore(timing.onsetErrorMs) * 0.7 + timingScore(timing.durationErrorMs) * 0.3, 0) / timings.length
}
