import { midiToFrequency } from '../music/noteUtils'
import type { ReferenceTrack } from '../types/music'

const ATTACK_SECONDS = 0.015
const RELEASE_SECONDS = 0.04

function beatAtTime(track: ReferenceTrack, target: number) {
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

function timeAtBeat(track: ReferenceTrack, targetBeat: number) {
  const tempos = track.tempoChanges?.length ? track.tempoChanges : [{ time: 0, bpm: track.bpm ?? 60 }]
  let elapsedBeats = 0
  for (let index = 0; index < tempos.length; index++) {
    const tempo = tempos[index]
    const segmentEnd = tempos[index + 1]?.time
    const segmentBeats = segmentEnd === undefined ? Number.POSITIVE_INFINITY : (segmentEnd - tempo.time) * tempo.bpm / 60
    if (targetBeat <= elapsedBeats + segmentBeats) return tempo.time + (targetBeat - elapsedBeats) * 60 / tempo.bpm
    elapsedBeats += segmentBeats
  }
  return 0
}

export class ReferencePlayer {
  private readonly masterGain: GainNode
  private readonly oscillators: OscillatorNode[] = []
  private stopped = false

  constructor(private readonly context: AudioContext, volume: number) {
    this.masterGain = context.createGain()
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume))
    this.masterGain.connect(context.destination)
  }

  schedule(track: ReferenceTrack, startedAt: number) {
    for (const note of track.notes) {
      const noteStart = startedAt + note.start
      const noteEnd = noteStart + note.duration
      const releaseStart = Math.max(noteStart + ATTACK_SECONDS, noteEnd - RELEASE_SECONDS)
      const oscillator = this.context.createOscillator()
      const envelope = this.context.createGain()

      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(midiToFrequency(note.midi), noteStart)
      envelope.gain.setValueAtTime(0, noteStart)
      envelope.gain.linearRampToValueAtTime(0.7, noteStart + ATTACK_SECONDS)
      envelope.gain.setValueAtTime(0.7, releaseStart)
      envelope.gain.linearRampToValueAtTime(0, noteEnd)

      oscillator.connect(envelope)
      envelope.connect(this.masterGain)
      oscillator.start(noteStart)
      oscillator.stop(noteEnd + 0.01)
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect()
        envelope.disconnect()
      }, { once: true })
      this.oscillators.push(oscillator)
    }
  }

  scheduleCue(midi: number, startedAt: number, duration: number) {
    this.scheduleTone(midiToFrequency(midi), startedAt, duration, 'sine', 0.45)
  }

  scheduleMetronome(track: ReferenceTrack, startedAt: number, countStartedAt: number, countInBeats: number) {
    const initialBpm = track.tempoChanges?.[0]?.bpm ?? track.bpm ?? 60
    const initialSignature = track.timeSignatures?.[0]
    const countPulseBeats = initialSignature?.clocksPerClick ? initialSignature.clocksPerClick / 24 : (initialSignature && initialSignature.numerator > 3 && initialSignature.numerator % 3 === 0 ? 1.5 : 4 / (initialSignature?.denominator ?? 4))
    const countBeatDuration = 60 / initialBpm * countPulseBeats
    for (let beat = 0; beat < countInBeats; beat++) this.scheduleClick(countStartedAt + beat * countBeatDuration, beat === 0)

    const duration = Math.max(0, ...track.notes.map((note) => note.start + note.duration))
    const durationBeats = beatAtTime(track, duration)
    const signatures = (track.timeSignatures?.length ? track.timeSignatures : [{ time: 0, numerator: 4, denominator: 4, clocksPerClick: 24 }])
      .map((signature) => ({ ...signature, beat: beatAtTime(track, signature.time) }))
      .filter((signature) => signature.beat <= durationBeats + 0.001)
      .sort((a, b) => a.beat - b.beat)
    signatures.forEach((signature, index) => {
      const segmentEnd = Math.min(durationBeats, signatures[index + 1]?.beat ?? durationBeats)
      const measureBeats = signature.numerator * 4 / signature.denominator
      const pulseBeats = signature.clocksPerClick ? signature.clocksPerClick / 24 : (signature.numerator > 3 && signature.numerator % 3 === 0 ? 1.5 : 4 / signature.denominator)
      for (let beat = signature.beat; beat < segmentEnd - 0.001; beat += pulseBeats) {
        const positionInMeasure = (beat - signature.beat) % measureBeats
        this.scheduleClick(startedAt + timeAtBeat(track, beat), positionInMeasure < 0.001 || measureBeats - positionInMeasure < 0.001)
      }
    })
  }

  private scheduleClick(startedAt: number, accent: boolean) {
    this.scheduleTone(accent ? 1500 : 1000, startedAt, 0.045, 'square', accent ? 0.24 : 0.14)
  }

  private scheduleTone(frequency: number, startedAt: number, duration: number, type: OscillatorType, level: number) {
    const oscillator = this.context.createOscillator()
    const envelope = this.context.createGain()
    const endedAt = startedAt + duration
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, startedAt)
    envelope.gain.setValueAtTime(0, startedAt)
    envelope.gain.linearRampToValueAtTime(level, startedAt + Math.min(0.008, duration / 4))
    envelope.gain.exponentialRampToValueAtTime(0.0001, endedAt)
    oscillator.connect(envelope)
    envelope.connect(this.masterGain)
    oscillator.start(startedAt)
    oscillator.stop(endedAt + 0.01)
    oscillator.addEventListener('ended', () => { oscillator.disconnect(); envelope.disconnect() }, { once: true })
    this.oscillators.push(oscillator)
  }

  stop() {
    if (this.stopped) return
    this.stopped = true
    for (const oscillator of this.oscillators) {
      try { oscillator.stop() } catch { /* The oscillator may already have ended. */ }
    }
    this.oscillators.length = 0
    this.masterGain.disconnect()
  }
}
