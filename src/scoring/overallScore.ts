import type { EvaluatedFrame } from '../types/audio'
import type { ReferenceTrack } from '../types/music'
import { pitchScore } from './pitchScoring'
import { rhythmScore } from './rhythmScoring'

export interface SessionScore {
  pitch: number; rhythm: number; overall: number; notesEvaluated: number; notesHit: number
  above: number; below: number; maxErrorCents: number; averageErrorCents: number
}

export function calculateSessionScore(track: ReferenceTrack, frames: EvaluatedFrame[]): SessionScore {
  const pitch = pitchScore(frames)
  const rhythm = rhythmScore(track, frames)
  const evaluatedIds = new Set(frames.map((frame) => frame.expectedNoteId))
  const bestByNote = track.notes.map((note) => frames.filter((frame) => frame.expectedNoteId === note.id)).filter((items) => items.length).map((items) => items.reduce((best, item) => Math.abs(item.differenceCents) < Math.abs(best.differenceCents) ? item : best))
  const errors = frames.map((frame) => Math.abs(frame.differenceCents))
  return {
    pitch, rhythm, overall: pitch * 0.65 + rhythm * 0.35, notesEvaluated: evaluatedIds.size,
    notesHit: bestByNote.filter((frame) => Math.abs(frame.differenceCents) <= 40).length,
    above: bestByNote.filter((frame) => frame.differenceCents > 20).length,
    below: bestByNote.filter((frame) => frame.differenceCents < -20).length,
    maxErrorCents: errors.length ? Math.max(...errors) : 0,
    averageErrorCents: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : 0,
  }
}
