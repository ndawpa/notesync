import { describe, expect, it } from 'vitest'
import { parseMidiFile, parseMidiTracks } from './midiParser'

const midiBytes = new Uint8Array([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0,
  0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 58,
  0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20,
  0, 0xff, 3, 5, 0x56, 0x6f, 0x69, 0x63, 0x65,
  0, 0xff, 0x58, 4, 3, 3, 36, 8,
  0, 0xff, 0x59, 2, 0xff, 1,
  0, 0xff, 5, 2, 0x44, 0x6f,
  0, 0x90, 60, 100, 0x83, 0x60, 0x80, 60, 0,
  0, 0x90, 62, 100, 0x83, 0x60, 0x80, 62, 0,
  0, 0xff, 0x2f, 0,
])

describe('MIDI parser', () => {
  it('converts MIDI ticks and tempo to a reference track', () => {
    const track = parseMidiFile(midiBytes.buffer, 'escala.mid')
    expect(track.name).toBe('escala — Voice')
    expect(track.bpm).toBe(120)
    expect(track.tempoChanges).toEqual([{ time: 0, bpm: 120 }])
    expect(track.timeSignatures).toEqual([{ time: 0, numerator: 3, denominator: 8, clocksPerClick: 36 }])
    expect(track.keySignatures).toEqual([{ time: 0, fifths: -1, mode: 'minor' }])
    expect(track.notes).toHaveLength(2)
    expect(track.notes[0]).toMatchObject({ pitch: 'C4', midi: 60, start: 0, duration: 0.5, lyric: 'Do' })
    expect(track.notes[1]).toMatchObject({ pitch: 'D4', midi: 62, start: 0.5, duration: 0.5 })
  })

  it('rejects non-MIDI content', () => {
    expect(() => parseMidiFile(new Uint8Array([1, 2, 3]).buffer)).toThrow(/incompleto|cabeçalho/)
  })

  it('exposes the melodic track list for voice selection', () => {
    expect(parseMidiTracks(midiBytes.buffer, 'escala.mid').map((track) => track.name)).toEqual(['escala — Voice'])
  })
})
