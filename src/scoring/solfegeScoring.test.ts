import { describe, expect, it } from 'vitest'
import { DEFAULT_TRACK } from '../music/referenceTrack'
import { extractSolfegeSyllables, scoreSolfege } from './solfegeScoring'

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
})
