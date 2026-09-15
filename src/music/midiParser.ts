import type { ReferenceNote, ReferenceTrack } from '../types/music'
import { midiToNoteName } from './noteUtils'

interface RawNote { midi: number; startTick: number; endTick: number }
interface TempoEvent { tick: number; microsecondsPerBeat: number }
interface RawText { tick: number; text: string }
interface ParsedMidiTrack { name?: string; notes: RawNote[]; lyrics: RawText[]; texts: RawText[] }

class MidiReader {
  offset = 0
  constructor(private readonly view: DataView) {}
  get remaining() { return this.view.byteLength - this.offset }
  byte() { if (this.remaining < 1) throw new Error('Arquivo MIDI incompleto.'); return this.view.getUint8(this.offset++) }
  uint16() { if (this.remaining < 2) throw new Error('Arquivo MIDI incompleto.'); const value = this.view.getUint16(this.offset); this.offset += 2; return value }
  uint32() { if (this.remaining < 4) throw new Error('Arquivo MIDI incompleto.'); const value = this.view.getUint32(this.offset); this.offset += 4; return value }
  text(length: number) { return new TextDecoder().decode(this.bytes(length)) }
  bytes(length: number) { if (length < 0 || this.remaining < length) throw new Error('Arquivo MIDI incompleto.'); const value = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length); this.offset += length; return value }
  variableLength() {
    let value = 0
    for (let count = 0; count < 4; count++) { const next = this.byte(); value = (value << 7) | (next & 0x7f); if (!(next & 0x80)) return value }
    throw new Error('Valor MIDI variável inválido.')
  }
}

function parseTrack(data: Uint8Array, tempos: TempoEvent[]): ParsedMidiTrack {
  const reader = new MidiReader(new DataView(data.buffer, data.byteOffset, data.byteLength))
  const active = new Map<string, Array<{ midi: number; startTick: number }>>()
  const notes: RawNote[] = []
  const lyrics: RawText[] = [], texts: RawText[] = []
  let tick = 0, runningStatus = 0, name: string | undefined
  while (reader.remaining > 0) {
    tick += reader.variableLength()
    let status = reader.byte()
    let firstData: number | undefined
    if (status < 0x80) {
      if (!runningStatus) throw new Error('Running status MIDI inválido.')
      firstData = status; status = runningStatus
    } else if (status < 0xf0) runningStatus = status

    if (status === 0xff) {
      runningStatus = 0
      const type = reader.byte(), length = reader.variableLength(), payload = reader.bytes(length)
      if (type === 0x03) name = new TextDecoder().decode(payload)
      if (type === 0x05) lyrics.push({ tick, text: new TextDecoder().decode(payload) })
      if (type === 0x01) texts.push({ tick, text: new TextDecoder().decode(payload) })
      if (type === 0x51 && payload.length === 3) tempos.push({ tick, microsecondsPerBeat: (payload[0] << 16) | (payload[1] << 8) | payload[2] })
      if (type === 0x2f) break
      continue
    }
    if (status === 0xf0 || status === 0xf7) { reader.bytes(reader.variableLength()); runningStatus = 0; continue }
    if (status >= 0xf0) throw new Error(`Evento MIDI de sistema 0x${status.toString(16)} não suportado.`)

    const kind = status & 0xf0, channel = status & 0x0f
    const data1 = firstData ?? reader.byte()
    const data2 = kind === 0xc0 || kind === 0xd0 ? 0 : reader.byte()
    if (kind === 0x90 && data2 > 0) {
      const key = `${channel}:${data1}`
      const entries = active.get(key) ?? []
      entries.push({ midi: data1, startTick: tick }); active.set(key, entries)
    } else if (kind === 0x80 || (kind === 0x90 && data2 === 0)) {
      const key = `${channel}:${data1}`, entries = active.get(key)
      const started = entries?.shift()
      if (started && tick > started.startTick) notes.push({ ...started, endTick: tick })
      if (entries?.length === 0) active.delete(key)
    }
  }
  return { name, notes, lyrics, texts }
}

function makeTempoConverter(events: TempoEvent[], ticksPerBeat: number) {
  const sorted = [{ tick: 0, microsecondsPerBeat: 500_000 }, ...events]
    .sort((a, b) => a.tick - b.tick)
    .filter((event, index, list) => index === list.length - 1 || event.tick !== list[index + 1].tick)
  return (targetTick: number) => {
    let seconds = 0, previousTick = 0, tempo = 500_000
    for (const event of sorted) {
      if (event.tick > targetTick) break
      seconds += ((event.tick - previousTick) * tempo) / ticksPerBeat / 1_000_000
      previousTick = event.tick; tempo = event.microsecondsPerBeat
    }
    return seconds + ((targetTick - previousTick) * tempo) / ticksPerBeat / 1_000_000
  }
}

function toMonophonic(notes: RawNote[]): RawNote[] {
  const boundaries = [...new Set(notes.flatMap((note) => [note.startTick, note.endTick]))].sort((a, b) => a - b)
  const segments: RawNote[] = []
  for (let index = 0; index < boundaries.length - 1; index++) {
    const startTick = boundaries[index], endTick = boundaries[index + 1]
    const selected = notes.filter((note) => note.startTick <= startTick && note.endTick >= endTick).sort((a, b) => b.midi - a.midi)[0]
    if (!selected || endTick <= startTick) continue
    const previous = segments.at(-1)
    if (previous?.midi === selected.midi && previous.endTick === startTick) previous.endTick = endTick
    else segments.push({ midi: selected.midi, startTick, endTick })
  }
  return segments
}

export function parseMidiFile(buffer: ArrayBuffer, fileName = 'Exercício MIDI'): ReferenceTrack {
  const reader = new MidiReader(new DataView(buffer))
  if (reader.text(4) !== 'MThd') throw new Error('O arquivo não possui um cabeçalho MIDI válido.')
  const headerLength = reader.uint32()
  if (headerLength < 6) throw new Error('Cabeçalho MIDI inválido.')
  const format = reader.uint16(), trackCount = reader.uint16(), division = reader.uint16()
  if (headerLength > 6) reader.bytes(headerLength - 6)
  if (format > 1) throw new Error('MIDI tipo 2 ainda não é suportado.')
  if (division & 0x8000) throw new Error('MIDI com divisão temporal SMPTE ainda não é suportado.')
  if (!division || !trackCount) throw new Error('O arquivo MIDI não contém pistas válidas.')

  const tempos: TempoEvent[] = [], tracks: ParsedMidiTrack[] = []
  for (let index = 0; index < trackCount; index++) {
    if (reader.text(4) !== 'MTrk') throw new Error(`Cabeçalho da pista ${index + 1} inválido.`)
    tracks.push(parseTrack(reader.bytes(reader.uint32()), tempos))
  }
  const selected = tracks.filter((track) => track.notes.length).sort((a, b) => b.notes.length - a.notes.length)[0]
  if (!selected) throw new Error('Nenhuma nota foi encontrada no arquivo MIDI.')
  const tickToSeconds = makeTempoConverter(tempos, division)
  const monophonicNotes = toMonophonic(selected.notes)
  const lyricTrack = tracks.filter((track) => track.lyrics.length).sort((a, b) => b.lyrics.length - a.lyrics.length)[0]
  const textTrack = tracks.filter((track) => track.texts.length).sort((a, b) => b.texts.length - a.texts.length)[0]
  const rawLyrics = lyricTrack?.lyrics.length ? lyricTrack.lyrics : (textTrack?.texts ?? []).filter((item) => !item.text.trim().startsWith('@'))
  const lyricsByNote = new Map<number, string>()
  for (const lyric of rawLyrics) {
    const text = lyric.text.replace(/^[\\/]+/, '').trim()
    if (!text) continue
    let noteIndex = monophonicNotes.findIndex((note) => lyric.tick >= note.startTick && lyric.tick < note.endTick)
    if (noteIndex < 0) noteIndex = monophonicNotes.findIndex((note) => note.startTick >= lyric.tick)
    if (noteIndex < 0) noteIndex = monophonicNotes.length - 1
    const previous = lyricsByNote.get(noteIndex)
    lyricsByNote.set(noteIndex, previous ? `${previous}${previous.endsWith('-') ? '' : ' '}${text}` : text)
  }
  const notes: ReferenceNote[] = monophonicNotes.map((note, index) => ({
    id: String(index + 1), pitch: midiToNoteName(note.midi), midi: note.midi,
    start: tickToSeconds(note.startTick), duration: tickToSeconds(note.endTick) - tickToSeconds(note.startTick),
    lyric: lyricsByNote.get(index),
  }))
  const cleanName = fileName.replace(/\.(mid|midi)$/i, '')
  const orderedTempos = [{ tick: 0, microsecondsPerBeat: 500_000 }, ...tempos]
    .sort((a, b) => a.tick - b.tick)
    .filter((tempo, index, list) => index === list.length - 1 || tempo.tick !== list[index + 1].tick)
  const tempoChanges = orderedTempos.map((tempo) => ({ time: tickToSeconds(tempo.tick), bpm: 60_000_000 / tempo.microsecondsPerBeat }))
  return { name: selected.name ? `${cleanName} — ${selected.name}` : cleanName, bpm: Math.round(tempoChanges[0].bpm), tempoChanges, notes }
}
