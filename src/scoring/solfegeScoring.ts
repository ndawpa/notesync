import type { ReferenceTrack } from '../types/music'

export type SolfegeSyllable = 'Dó' | 'Ré' | 'Mi' | 'Fá' | 'Sol' | 'Lá' | 'Si'
export interface SolfegeItem { noteId: string; expected: SolfegeSyllable; recognized?: SolfegeSyllable; correct: boolean }
export interface SolfegeScore { score: number; total: number; correct: number; recognized: number; transcript: string; items: SolfegeItem[] }

const PITCH_CLASS_SYLLABLES: SolfegeSyllable[] = ['Dó', 'Dó', 'Ré', 'Ré', 'Mi', 'Fá', 'Fá', 'Sol', 'Sol', 'Lá', 'Lá', 'Si']

export function extractSolfegeSyllables(text: string): SolfegeSyllable[] {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return normalized.match(/[a-z]+/g)?.flatMap((word) => {
    if (/^do+$/.test(word)) return ['Dó' as const]
    if (/^re+$/.test(word)) return ['Ré' as const]
    if (/^mi+$/.test(word)) return ['Mi' as const]
    if (/^fa+$/.test(word)) return ['Fá' as const]
    if (/^so+l+$/.test(word)) return ['Sol' as const]
    if (/^la+$/.test(word)) return ['Lá' as const]
    if (/^si+$/.test(word)) return ['Si' as const]
    return []
  }) ?? []
}

export function expectedSolfege(track: ReferenceTrack) {
  return track.notes.map((note) => ({ noteId: note.id, syllable: PITCH_CLASS_SYLLABLES[((note.midi % 12) + 12) % 12] }))
}

export function scoreSolfege(track: ReferenceTrack, transcript: string): SolfegeScore {
  const expected = expectedSolfege(track)
  const recognized = extractSolfegeSyllables(transcript)
  const rows = expected.length + 1, columns = recognized.length + 1
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(0))
  const moves = Array.from({ length: rows }, () => Array<'match' | 'delete' | 'insert'>(columns).fill('match'))
  for (let row = 1; row < rows; row++) { costs[row][0] = row; moves[row][0] = 'delete' }
  for (let column = 1; column < columns; column++) { costs[0][column] = column; moves[0][column] = 'insert' }
  for (let row = 1; row < rows; row++) for (let column = 1; column < columns; column++) {
    const substitution = costs[row - 1][column - 1] + (expected[row - 1].syllable === recognized[column - 1] ? 0 : 1)
    const deletion = costs[row - 1][column] + 1, insertion = costs[row][column - 1] + 1
    const minimum = Math.min(substitution, deletion, insertion)
    costs[row][column] = minimum
    moves[row][column] = minimum === substitution ? 'match' : minimum === deletion ? 'delete' : 'insert'
  }
  const items: SolfegeItem[] = []
  let row = expected.length, column = recognized.length
  while (row > 0 || column > 0) {
    const move = moves[row][column]
    if (row > 0 && column > 0 && move === 'match') {
      const target = expected[row - 1], heard = recognized[column - 1]
      items.push({ noteId: target.noteId, expected: target.syllable, recognized: heard, correct: target.syllable === heard }); row--; column--
    } else if (row > 0 && (column === 0 || move === 'delete')) {
      const target = expected[row - 1]
      items.push({ noteId: target.noteId, expected: target.syllable, correct: false }); row--
    } else column--
  }
  items.reverse()
  const correct = items.filter((item) => item.correct).length
  return { score: expected.length ? correct / expected.length * 100 : 0, total: expected.length, correct, recognized: recognized.length, transcript: transcript.trim(), items }
}
