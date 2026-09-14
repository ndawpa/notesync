import { describe, expect, it } from 'vitest'
import { noteAtTime, parseReferenceTrack } from './referenceTrack'

describe('reference tracks', () => {
  it('accepts the compact array format', () => {
    const track = parseReferenceTrack([{ pitch: 'C4', midi: 60, start: 0, duration: 1 }])
    expect(noteAtTime(track, 0.5)?.midi).toBe(60)
    expect(noteAtTime(track, 1)).toBeUndefined()
  })
  it('rejects invalid durations', () => { expect(() => parseReferenceTrack([{ midi: 60, start: 0, duration: 0 }])).toThrow() })
})
