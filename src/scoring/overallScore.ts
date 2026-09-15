import type { EvaluatedFrame } from '../types/audio'
import type { ReferenceTrack } from '../types/music'
import { pitchScore, representativeCents } from './pitchScoring'
import { rhythmScore } from './rhythmScoring'

export interface SessionScore {
  pitch: number; rhythm: number; overall: number; notesEvaluated: number; notesDetected: number; notesMissed: number; notesHit: number
  above: number; below: number; maxErrorCents: number; averageErrorCents: number
}

export function calculateSessionScore(track: ReferenceTrack, frames: EvaluatedFrame[]): SessionScore {
  const pitch = pitchScore(track, frames)
  const rhythm = rhythmScore(track, frames)
  const evaluatedIds = new Set(frames.map((frame) => frame.expectedNoteId))
  const centsByNote = track.notes.map((note) => frames.filter((frame) => frame.expectedNoteId === note.id)).filter((items) => items.length).map(representativeCents)
  const errors = frames.map((frame) => Math.abs(frame.differenceCents))
  return {
    pitch, rhythm, overall: pitch * 0.65 + rhythm * 0.35,
    notesEvaluated: track.notes.length, notesDetected: evaluatedIds.size, notesMissed: track.notes.length - evaluatedIds.size,
    notesHit: centsByNote.filter((cents) => Math.abs(cents) <= 40).length,
    above: centsByNote.filter((cents) => cents > 20).length,
    below: centsByNote.filter((cents) => cents < -20).length,
    maxErrorCents: errors.length ? Math.max(...errors) : 0,
    averageErrorCents: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : 0,
  }
}
