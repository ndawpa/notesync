import { describe, expect, it } from 'vitest'
import { scorePitchDifference } from './pitchScoring'
import { calculateSessionScore } from './overallScore'
import { DEFAULT_TRACK } from '../music/referenceTrack'
import type { EvaluatedFrame } from '../types/audio'

const frame = (expectedNoteId: string, differenceCents = 0, timestamp = 0): EvaluatedFrame => ({
  expectedNoteId, expectedMidi: 60, differenceCents, timestamp,
  frequency: 261.63, midi: 60, note: 'C4', cents: differenceCents, confidence: 1, volume: 0.1,
})

describe('scoring', () => {
  it('uses configurable pitch bands', () => { expect(scorePitchDifference(20)).toBe(100); expect(scorePitchDifference(40)).toBe(80); expect(scorePitchDifference(200)).toBe(0) })
  it('counts silence as missed notes', () => {
    const score = calculateSessionScore(DEFAULT_TRACK, [])
    expect(score).toMatchObject({ overall: 0, notesEvaluated: 5, notesDetected: 0, notesMissed: 5, notesHit: 0 })
  })
  it('penalizes notes omitted from an otherwise accurate performance', () => {
    const score = calculateSessionScore(DEFAULT_TRACK, [frame('1', 0, 0), frame('1', 0, 0.98)])
    expect(score.pitch).toBe(20)
    expect(score.rhythm).toBe(20)
    expect(score.overall).toBe(20)
    expect(score.notesMissed).toBe(4)
  })
})
