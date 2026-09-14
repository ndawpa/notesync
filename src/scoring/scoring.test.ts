import { describe, expect, it } from 'vitest'
import { scorePitchDifference } from './pitchScoring'
import { calculateSessionScore } from './overallScore'
import { DEFAULT_TRACK } from '../music/referenceTrack'

describe('scoring', () => {
  it('uses configurable pitch bands', () => { expect(scorePitchDifference(20)).toBe(100); expect(scorePitchDifference(40)).toBe(80); expect(scorePitchDifference(200)).toBe(0) })
  it('returns an empty session safely', () => { expect(calculateSessionScore(DEFAULT_TRACK, []).overall).toBe(0) })
})
