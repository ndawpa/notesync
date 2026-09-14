import { describe, expect, it } from 'vitest'
import { frequencyDifferenceInCents, frequencyToMidi, midiToFrequency, midiToNoteName } from './noteUtils'

describe('note utilities', () => {
  it('converts A4 in both directions', () => { expect(frequencyToMidi(440)).toBe(69); expect(midiToFrequency(69)).toBe(440); expect(midiToNoteName(69)).toBe('A4') })
  it('measures cents instead of only note names', () => { expect(frequencyDifferenceInCents(440, 440)).toBeCloseTo(0); expect(frequencyDifferenceInCents(430, 440)).toBeCloseTo(-39.8, 1) })
})
