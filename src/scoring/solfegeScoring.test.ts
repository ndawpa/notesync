import { describe, expect, it } from 'vitest'
import { DEFAULT_TRACK } from '../music/referenceTrack'
import { expectedSolfege, extractSolfegeSyllables, scoreSolfege, scoreTimedSolfege } from './solfegeScoring'

describe('solfege scoring', () => {
  it('normalizes Portuguese syllables and prolonged vowels', () => {
    expect(extractSolfegeSyllables('Dó, réé mi fáá sol lá si')).toEqual(['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'])
  })

  it('aligns missing syllables without shifting the remaining exercise', () => {
    const result = scoreSolfege(DEFAULT_TRACK, 'dó ré fá sol')
    expect(result).toMatchObject({ total: 5, correct: 4, score: 80 })
    expect(result.items[2]).toMatchObject({ expected: 'Mi', correct: false })
    expect(result.items[2].recognized).toBeUndefined()
  })

  it('understands spoken accidentals and movable Do', () => {
    expect(extractSolfegeSyllables('dó sustenido, ré bemol')).toEqual(['Dó♯', 'Ré♭'])
    const inG = { ...DEFAULT_TRACK, keySignatures: [{ time: 0, fifths: 1, mode: 'major' as const }], notes: [{ ...DEFAULT_TRACK.notes[0], midi: 67 }] }
    expect(expectedSolfege(inG, 'movable')[0].syllable).toBe('Dó')
  })

  it('uses word timestamps to associate syllables with notes', () => {
    const result = scoreTimedSolfege(DEFAULT_TRACK, { text: 'dó ré mi fá sol', words: DEFAULT_TRACK.notes.map((note, index) => ({ text: ['dó', 'ré', 'mi', 'fá', 'sol'][index], start: note.start, end: note.start + 0.2 })) })
    expect(result).toMatchObject({ total: 5, correct: 5, score: 100 })
    expect(result.items[0].timingErrorMs).toBe(100)
  })
})
