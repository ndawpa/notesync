import type { ReferenceTrack } from '../types/music'
import { midiToNoteName } from './noteUtils'

export const DEFAULT_TRACK: ReferenceTrack = {
  name: 'Exercício C maior',
  bpm: 60,
  notes: [
    { id: '1', pitch: 'C4', midi: 60, start: 0, duration: 1 },
    { id: '2', pitch: 'D4', midi: 62, start: 1, duration: 1 },
    { id: '3', pitch: 'E4', midi: 64, start: 2, duration: 1 },
    { id: '4', pitch: 'F4', midi: 65, start: 3, duration: 1 },
    { id: '5', pitch: 'G4', midi: 67, start: 4, duration: 2 },
  ],
}

export const trackDuration = (track: ReferenceTrack) => Math.max(0, ...track.notes.map((note) => note.start + note.duration))
export const noteAtTime = (track: ReferenceTrack, time: number) => track.notes.find((note) => time >= note.start && time < note.start + note.duration)

export function parseReferenceTrack(value: unknown): ReferenceTrack {
  const candidate = Array.isArray(value) ? { name: 'Exercício carregado', notes: value } : value
  if (!candidate || typeof candidate !== 'object') throw new Error('JSON inválido.')
  const data = candidate as Partial<ReferenceTrack>
  if (!Array.isArray(data.notes) || data.notes.length === 0) throw new Error('O exercício precisa conter notas.')
  const notes = data.notes.map((raw, index) => {
    const note = raw as Partial<ReferenceTrack['notes'][number]>
    if (!Number.isFinite(note.midi) || !Number.isFinite(note.start) || !Number.isFinite(note.duration) || Number(note.duration) <= 0) throw new Error(`Nota ${index + 1} inválida.`)
    return { id: note.id ?? String(index + 1), pitch: note.pitch || midiToNoteName(Number(note.midi)), midi: Number(note.midi), start: Number(note.start), duration: Number(note.duration) }
  }).sort((a, b) => a.start - b.start)
  return { name: data.name || 'Exercício carregado', bpm: data.bpm, notes }
}
