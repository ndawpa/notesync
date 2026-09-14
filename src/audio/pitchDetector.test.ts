import { describe, expect, it } from 'vitest'
import { detectPitchYin, rootMeanSquare } from './pitchDetector'

describe('YIN pitch detector', () => {
  it('detects a clean A4 sine wave', () => {
    const rate = 48000
    const samples = Float32Array.from({ length: 4096 }, (_, index) => 0.2 * Math.sin(2 * Math.PI * 440 * index / rate))
    const result = detectPitchYin(samples, rate)
    expect(result?.frequency).toBeCloseTo(440, 0)
    expect(result?.confidence).toBeGreaterThan(0.9)
  })
  it('ignores silence', () => { expect(rootMeanSquare(new Float32Array(100))).toBe(0); expect(detectPitchYin(new Float32Array(4096), 48000)).toBeNull() })
})
