import { describe, expect, it } from 'vitest'
import { DEFAULT_TRACK } from './referenceTrack'
import { correctOctaveFrequency, extractMeasureRange, suggestTransposition, trackMidiRange, transposeTrack, VOCAL_RANGES } from './practiceUtils'
import { measureRanges } from './timingUtils'

describe('practice utilities', () => {
  it('transposes without changing time', () => expect(transposeTrack(DEFAULT_TRACK, -12).notes[0]).toMatchObject({ midi: 48, pitch: 'C3', start: 0 }))
  it('builds and extracts measure ranges', () => {
    expect(measureRanges(DEFAULT_TRACK, 6)).toHaveLength(2)
    expect(extractMeasureRange(DEFAULT_TRACK, 2, 2).notes[0].start).toBe(0)
  })
  it('corrects a detected octave near the expected note', () => expect(correctOctaveFrequency(220, 69)).toBeCloseTo(440))
  it('summarizes the extension and suggests a vocal-range transposition', () => {
    expect(trackMidiRange(DEFAULT_TRACK)).toEqual({ min: 60, max: 67 })
    expect(suggestTransposition(DEFAULT_TRACK, VOCAL_RANGES.bass)).toBe(-13)
  })
})
