import type { ReferenceTrack, TimeSignatureChange } from '../types/music'

export function beatAtTime(track: ReferenceTrack, target: number) {
  const tempos = track.tempoChanges?.length ? track.tempoChanges : [{ time: 0, bpm: track.bpm ?? 60 }]
  let beats = 0
  for (let index = 0; index < tempos.length; index++) {
    const tempo = tempos[index]
    if (tempo.time >= target) break
    const end = Math.min(target, tempos[index + 1]?.time ?? target)
    beats += Math.max(0, end - tempo.time) * tempo.bpm / 60
  }
  return beats
}

export function timeAtBeat(track: ReferenceTrack, targetBeat: number) {
  const tempos = track.tempoChanges?.length ? track.tempoChanges : [{ time: 0, bpm: track.bpm ?? 60 }]
  let elapsedBeats = 0
  for (let index = 0; index < tempos.length; index++) {
    const tempo = tempos[index]
    const end = tempos[index + 1]?.time
    const segmentBeats = end === undefined ? Number.POSITIVE_INFINITY : (end - tempo.time) * tempo.bpm / 60
    if (targetBeat <= elapsedBeats + segmentBeats) return tempo.time + (targetBeat - elapsedBeats) * 60 / tempo.bpm
    elapsedBeats += segmentBeats
  }
  return 0
}

export interface MeasureRange { number: number; startBeat: number; endBeat: number; startTime: number; endTime: number; signature: TimeSignatureChange }

export function measureRanges(track: ReferenceTrack, duration: number): MeasureRange[] {
  const durationBeats = beatAtTime(track, duration)
  const signatures = (track.timeSignatures?.length ? track.timeSignatures : [{ time: 0, numerator: 4, denominator: 4 }])
    .map((signature) => ({ ...signature, beat: beatAtTime(track, signature.time) })).sort((a, b) => a.beat - b.beat)
  const ranges: MeasureRange[] = []
  for (let index = 0; index < signatures.length; index++) {
    const signature = signatures[index]
    const segmentEnd = Math.min(durationBeats, signatures[index + 1]?.beat ?? durationBeats)
    const size = signature.numerator * 4 / signature.denominator
    for (let startBeat = signature.beat; startBeat < segmentEnd - 0.001; startBeat += size) {
      const endBeat = Math.min(startBeat + size, segmentEnd)
      ranges.push({ number: ranges.length + 1, startBeat, endBeat, startTime: timeAtBeat(track, startBeat), endTime: timeAtBeat(track, endBeat), signature })
    }
  }
  return ranges
}

export function measureAtTime(track: ReferenceTrack, duration: number, time: number) {
  return measureRanges(track, duration).find((measure) => time >= measure.startTime && time < measure.endTime)?.number ?? measureRanges(track, duration).at(-1)?.number ?? 1
}
