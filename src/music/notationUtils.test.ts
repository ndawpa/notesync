import { describe, expect, it } from 'vitest'
import { closestRhythmFigure, midiToStaffStep, secondsToBeats, splitIntoRhythmFigures } from './notationUtils'
import { midiToDisplayName } from './noteUtils'

describe('music notation utilities', () => {
  it('names notes as letters or solfege', () => {
    expect(midiToDisplayName(60, 'letter')).toBe('C4')
    expect(midiToDisplayName(61, 'solfege')).toBe('Dó#4')
  })

  it('maps durations to conventional figures using BPM', () => {
    expect(secondsToBeats(1, 60)).toBe(1)
    expect(closestRhythmFigure(1).name).toBe('semínima')
    expect(closestRhythmFigure(4).name).toBe('semibreve')
  })

  it('splits rests and maps pitch vertically', () => {
    expect(splitIntoRhythmFigures(5).map((figure) => figure.name)).toEqual(['semibreve', 'semínima'])
    expect(midiToStaffStep(67) - midiToStaffStep(64)).toBe(2)
  })
})
