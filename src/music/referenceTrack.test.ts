import { describe, expect, it } from 'vitest'
import { changeTrackBpm, noteAtTime, parseReferenceTrack } from './referenceTrack'

describe('reference tracks', () => {
  it('accepts the compact array format', () => {
    const track = parseReferenceTrack([{ pitch: 'C4', midi: 60, start: 0, duration: 1 }])
    expect(noteAtTime(track, 0.5)?.midi).toBe(60)
    expect(noteAtTime(track, 1)).toBeUndefined()
  })
  it('rejects invalid durations', () => { expect(() => parseReferenceTrack([{ midi: 60, start: 0, duration: 0 }])).toThrow() })
  it('changes BPM while preserving beat positions and relative tempo changes', () => {
    const track = changeTrackBpm({ name: 'Teste', bpm: 120, tempoChanges: [{ time: 0, bpm: 120 }, { time: 2, bpm: 60 }], notes: [{ id: '1', pitch: 'C4', midi: 60, start: 1, duration: 2, lyric: 'Dó' }] }, 60)
    expect(track.notes[0]).toMatchObject({ start: 2, duration: 4, lyric: 'Dó' })
    expect(track.tempoChanges).toEqual([{ time: 0, bpm: 60 }, { time: 4, bpm: 30 }])
  })
})
