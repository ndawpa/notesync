import type { SolfegeRecognition } from '../audio/solfegeRecognizer'
import type { ReferenceTrack } from '../types/music'

export type SolfegeSystem = 'fixed' | 'movable'
export type SolfegeSyllable = string
export interface SolfegeItem { noteId: string; expected: SolfegeSyllable; recognized?: SolfegeSyllable; correct: boolean; timingErrorMs?: number }
export interface SolfegeScore { score: number; total: number; correct: number; recognized: number; transcript: string; items: SolfegeItem[] }

const FIXED_SHARPS = ['Dó', 'Dó♯', 'Ré', 'Ré♯', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Lá♯', 'Si']
const FIXED_FLATS = ['Dó', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Sol♭', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si']

function normalizedWords(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z]+/g) ?? []
}

export function extractSolfegeSyllables(text: string): SolfegeSyllable[] {
  const words = normalizedWords(text), syllables: string[] = []
  for (let index = 0; index < words.length; index++) {
    const word = words[index]
    const base = /^do+$/.test(word) ? 'Dó' : /^re+$/.test(word) ? 'Ré' : /^mi+$/.test(word) ? 'Mi' : /^fa+$/.test(word) ? 'Fá' : /^so+l+$/.test(word) ? 'Sol' : /^la+$/.test(word) ? 'Lá' : /^si+$/.test(word) ? 'Si' : undefined
    if (!base) continue
    const modifier = words[index + 1]
    if (/^sustenido$/.test(modifier)) { syllables.push(`${base}♯`); index++ }
    else if (/^bemol$/.test(modifier)) { syllables.push(`${base}♭`); index++ }
    else syllables.push(base)
  }
  return syllables
}

function tonicPitchClass(track: ReferenceTrack) {
  const key = track.keySignatures?.[0]
  const majorTonic = ((7 * (key?.fifths ?? 0)) % 12 + 12) % 12
  return key?.mode === 'minor' ? (majorTonic + 9) % 12 : majorTonic
}

export function expectedSolfege(track: ReferenceTrack, system: SolfegeSystem = 'fixed') {
  const preferFlats = (track.keySignatures?.[0]?.fifths ?? 0) < 0
  const labels = preferFlats ? FIXED_FLATS : FIXED_SHARPS
  const tonic = system === 'movable' ? tonicPitchClass(track) : 0
  return track.notes.map((note) => ({ noteId: note.id, syllable: labels[(((note.midi % 12) + 12) % 12 - tonic + 12) % 12] }))
}

function align(expected: ReturnType<typeof expectedSolfege>, recognized: string[]) {
  const rows = expected.length + 1, columns = recognized.length + 1
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(0))
  const moves = Array.from({ length: rows }, () => Array<'match' | 'delete' | 'insert'>(columns).fill('match'))
  for (let row = 1; row < rows; row++) { costs[row][0] = row; moves[row][0] = 'delete' }
  for (let column = 1; column < columns; column++) { costs[0][column] = column; moves[0][column] = 'insert' }
  for (let row = 1; row < rows; row++) for (let column = 1; column < columns; column++) {
    const substitution = costs[row - 1][column - 1] + (expected[row - 1].syllable === recognized[column - 1] ? 0 : 1)
    const deletion = costs[row - 1][column] + 1, insertion = costs[row][column - 1] + 1
    const minimum = Math.min(substitution, deletion, insertion)
    costs[row][column] = minimum; moves[row][column] = minimum === substitution ? 'match' : minimum === deletion ? 'delete' : 'insert'
  }
  const items: SolfegeItem[] = []
  let row = expected.length, column = recognized.length
  while (row > 0 || column > 0) {
    const move = moves[row][column]
    if (row > 0 && column > 0 && move === 'match') { const target = expected[row - 1], heard = recognized[column - 1]; items.push({ noteId: target.noteId, expected: target.syllable, recognized: heard, correct: target.syllable === heard }); row--; column-- }
    else if (row > 0 && (column === 0 || move === 'delete')) { const target = expected[row - 1]; items.push({ noteId: target.noteId, expected: target.syllable, correct: false }); row-- }
    else column--
  }
  return items.reverse()
}

export function scoreSolfege(track: ReferenceTrack, transcript: string, system: SolfegeSystem = 'fixed'): SolfegeScore {
  const expected = expectedSolfege(track, system), recognized = extractSolfegeSyllables(transcript)
  const items = align(expected, recognized), correct = items.filter((item) => item.correct).length
  return { score: expected.length ? correct / expected.length * 100 : 0, total: expected.length, correct, recognized: recognized.length, transcript: transcript.trim(), items }
}

export function scoreTimedSolfege(track: ReferenceTrack, recognition: SolfegeRecognition, system: SolfegeSystem = 'fixed'): SolfegeScore {
  const expected = expectedSolfege(track, system)
  const recognized: Array<{ syllable: string; time: number }> = []
  for (let index = 0; index < recognition.words.length; index++) {
    const word = recognition.words[index], syllable = extractSolfegeSyllables(word.text)[0]
    if (!syllable) continue
    const modifier = normalizedWords(recognition.words[index + 1]?.text ?? '')[0]
    const suffix = modifier === 'sustenido' ? '♯' : modifier === 'bemol' ? '♭' : ''
    recognized.push({ syllable: `${syllable}${suffix}`, time: (word.start + word.end) / 2 })
    if (suffix) index++
  }
  if (!recognized.length) return scoreSolfege(track, recognition.text, system)
  const used = new Set<number>()
  const items: SolfegeItem[] = track.notes.map((note, index) => {
    const center = note.start + note.duration / 2
    let bestIndex = -1, bestDistance = Number.POSITIVE_INFINITY
    recognized.forEach((word, wordIndex) => { if (!used.has(wordIndex) && Math.abs(word.time - center) < bestDistance) { bestIndex = wordIndex; bestDistance = Math.abs(word.time - center) } })
    if (bestIndex < 0 || bestDistance > Math.max(0.5, note.duration)) return { noteId: note.id, expected: expected[index].syllable, correct: false }
    used.add(bestIndex); const heard = recognized[bestIndex]
    return { noteId: note.id, expected: expected[index].syllable, recognized: heard.syllable, correct: heard.syllable === expected[index].syllable, timingErrorMs: Math.round((heard.time - note.start) * 1000) }
  })
  const correct = items.filter((item) => item.correct).length
  return { score: expected.length ? correct / expected.length * 100 : 0, total: expected.length, correct, recognized: recognized.length, transcript: recognition.text.trim(), items }
}
