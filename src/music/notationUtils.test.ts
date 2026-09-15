import { describe, expect, it } from 'vitest'
import { chooseAutomaticClef, closestRhythmFigure, ledgerLinePositions, midiToStaffStep, resolveClef, secondsToBeats, splitIntoRhythmFigures } from './notationUtils'
import { midiToDisplayName } from './noteUtils'

describe('music notation utilities', () => {
  it('names notes as letters or solfege', () => {
    expect(midiToDisplayName(60, 'letter')).toBe('C4')
    expect(midiToDisplayName(61, 'solfege')).toBe('Dó#4')
    expect(midiToDisplayName(60, 'letter', false)).toBe('C')
    expect(midiToDisplayName(61, 'solfege', false)).toBe('Dó#')
    expect(midiToDisplayName(61, 'letter', false, true)).toBe('D♭')
    expect(midiToDisplayName(61, 'solfege', false, true)).toBe('Ré♭')
    expect(midiToDisplayName(60, 'hidden')).toBe('')
  })

  it('maps durations to conventional figures using BPM', () => {
    expect(secondsToBeats(1, 60)).toBe(1)
    expect(closestRhythmFigure(1).name).toBe('semínima')
    expect(closestRhythmFigure(4).name).toBe('semibreve')
    expect(closestRhythmFigure(0.75).name).toBe('colcheia pontuada')
  })

  it('splits rests and maps pitch vertically', () => {
    expect(splitIntoRhythmFigures(5).map((figure) => figure.name)).toEqual(['semibreve', 'semínima'])
    expect(midiToStaffStep(67) - midiToStaffStep(64)).toBe(2)
  })

  it('selects a clef that keeps the melody near the staff', () => {
    expect(chooseAutomaticClef([67, 69, 72, 74])).toBe('treble')
    expect(chooseAutomaticClef([52, 55, 57, 60])).toBe('treble8vb')
    expect(chooseAutomaticClef([36, 40, 43, 48])).toBe('bass')
    expect(resolveClef('bass', [72])).toBe('bass')
  })

  it('does not draw a ledger line in the first space outside the staff', () => {
    expect(ledgerLinePositions(96, 42, 90, 12)).toEqual([])
    expect(ledgerLinePositions(102, 42, 90, 12)).toEqual([102])
    expect(ledgerLinePositions(114, 42, 90, 12)).toEqual([102, 114])
    expect(ledgerLinePositions(36, 42, 90, 12)).toEqual([])
    expect(ledgerLinePositions(30, 42, 90, 12)).toEqual([30])
  })
})
