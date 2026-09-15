import type { ReferenceTrack } from '../types/music'
import { midiToNoteName } from './noteUtils'

export const DEFAULT_TRACK: ReferenceTrack = {
  name: 'Exercício C maior',
  bpm: 60,
  timeSignatures: [{ time: 0, numerator: 4, denominator: 4, clocksPerClick: 24 }],
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

export function changeTrackBpm(track: ReferenceTrack, bpm: number): ReferenceTrack {
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) throw new Error('O BPM deve estar entre 20 e 300.')
  const currentBpm = track.tempoChanges?.[0]?.bpm ?? track.bpm ?? 60
  const timeScale = currentBpm / bpm
  const tempoScale = bpm / currentBpm
  return {
    ...track,
    bpm,
    notes: track.notes.map((note) => ({ ...note, start: note.start * timeScale, duration: note.duration * timeScale })),
    tempoChanges: track.tempoChanges?.map((tempo) => ({ time: tempo.time * timeScale, bpm: tempo.bpm * tempoScale })),
    timeSignatures: track.timeSignatures?.map((signature) => ({ ...signature, time: signature.time * timeScale })),
  }
}

export function parseReferenceTrack(value: unknown): ReferenceTrack {
  const candidate = Array.isArray(value) ? { name: 'Exercício carregado', notes: value } : value
  if (!candidate || typeof candidate !== 'object') throw new Error('JSON inválido.')
  const data = candidate as Partial<ReferenceTrack>
  if (!Array.isArray(data.notes) || data.notes.length === 0) throw new Error('O exercício precisa conter notas.')
  const notes = data.notes.map((raw, index) => {
    const note = raw as Partial<ReferenceTrack['notes'][number]>
    if (!Number.isFinite(note.midi) || !Number.isFinite(note.start) || !Number.isFinite(note.duration) || Number(note.duration) <= 0) throw new Error(`Nota ${index + 1} inválida.`)
    return { id: note.id ?? String(index + 1), pitch: note.pitch || midiToNoteName(Number(note.midi)), midi: Number(note.midi), start: Number(note.start), duration: Number(note.duration), lyric: typeof note.lyric === 'string' ? note.lyric : undefined }
  }).sort((a, b) => a.start - b.start)
  const tempoChanges = data.tempoChanges?.filter((tempo) => Number.isFinite(tempo.time) && Number.isFinite(tempo.bpm) && tempo.time >= 0 && tempo.bpm > 0).sort((a, b) => a.time - b.time)
  const validDenominators = [1, 2, 4, 8, 16, 32, 64, 128]
  const importedSignatures = data.timeSignatures?.filter((signature) => Number.isFinite(signature.time) && Number.isInteger(signature.numerator) && Number.isInteger(signature.denominator) && signature.time >= 0 && signature.numerator > 0 && validDenominators.includes(signature.denominator)) ?? []
  const timeSignatures = [{ time: 0, numerator: 4, denominator: 4, clocksPerClick: 24 }, ...importedSignatures]
    .sort((a, b) => a.time - b.time)
    .filter((signature, index, list) => index === list.length - 1 || signature.time !== list[index + 1].time)
  return { name: data.name || 'Exercício carregado', bpm: data.bpm, tempoChanges, timeSignatures, notes }
}
