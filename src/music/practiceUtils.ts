import type { ReferenceTrack } from '../types/music'
import { midiToNoteName } from './noteUtils'
import { measureRanges } from './timingUtils'
import { trackDuration } from './referenceTrack'

export function transposeTrack(track: ReferenceTrack, semitones: number): ReferenceTrack {
  const amount = Math.max(-48, Math.min(48, Math.round(semitones)))
  return { ...track, notes: track.notes.map((note) => { const midi = Math.max(0, Math.min(127, note.midi + amount)); return { ...note, midi, pitch: midiToNoteName(midi) } }) }
}

export function extractMeasureRange(track: ReferenceTrack, firstMeasure: number, lastMeasure: number): ReferenceTrack {
  const measures = measureRanges(track, trackDuration(track))
  const first = measures[Math.max(0, firstMeasure - 1)] ?? measures[0]
  const last = measures[Math.max(0, Math.min(measures.length - 1, lastMeasure - 1))] ?? measures.at(-1)
  if (!first || !last || last.endTime <= first.startTime) return track
  const offset = first.startTime
  const notes = track.notes.filter((note) => note.start < last.endTime && note.start + note.duration > first.startTime).map((note) => ({ ...note, start: Math.max(0, note.start - offset), duration: Math.min(note.start + note.duration, last.endTime) - Math.max(note.start, first.startTime) }))
  const shiftEvents = <T extends { time: number }>(events: T[] | undefined) => events?.filter((event) => event.time < last.endTime).map((event) => ({ ...event, time: Math.max(0, event.time - offset) }))
  return { ...track, name: `${track.name} · compassos ${first.number}–${last.number}`, notes, tempoChanges: shiftEvents(track.tempoChanges), timeSignatures: shiftEvents(track.timeSignatures), keySignatures: shiftEvents(track.keySignatures) }
}

export function correctOctaveFrequency(frequency: number, expectedMidi: number, maxDistanceSemitones = 7) {
  const expectedFrequency = 440 * 2 ** ((expectedMidi - 69) / 12)
  const candidates = [frequency / 2, frequency, frequency * 2]
  const closest = candidates.reduce((best, candidate) => Math.abs(Math.log2(candidate / expectedFrequency)) < Math.abs(Math.log2(best / expectedFrequency)) ? candidate : best)
  const distance = Math.abs(12 * Math.log2(closest / expectedFrequency))
  return distance <= maxDistanceSemitones ? closest : frequency
}

export interface MidiRange { min: number; max: number }

export const VOCAL_RANGES = {
  soprano: { min: 60, max: 81 },
  alto: { min: 53, max: 74 },
  tenor: { min: 48, max: 69 },
  bass: { min: 40, max: 62 },
} satisfies Record<string, MidiRange>

export function trackMidiRange(track: ReferenceTrack): MidiRange | undefined {
  if (!track.notes.length) return undefined
  return { min: Math.min(...track.notes.map((note) => note.midi)), max: Math.max(...track.notes.map((note) => note.midi)) }
}

export function suggestTransposition(track: ReferenceTrack, target: MidiRange): number {
  const range = trackMidiRange(track)
  if (!range) return 0
  const targetCenter = (target.min + target.max) / 2
  const trackCenter = (range.min + range.max) / 2
  let best = 0
  let bestCost = Number.POSITIVE_INFINITY
  for (let semitones = -24; semitones <= 24; semitones++) {
    const shiftedMin = range.min + semitones, shiftedMax = range.max + semitones
    const outside = Math.max(0, target.min - shiftedMin) + Math.max(0, shiftedMax - target.max)
    const cost = outside * 100 + Math.abs(trackCenter + semitones - targetCenter)
    if (cost < bestCost) { best = semitones; bestCost = cost }
  }
  return best
}
