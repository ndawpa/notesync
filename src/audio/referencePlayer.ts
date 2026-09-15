import { midiToFrequency } from '../music/noteUtils'
import type { ReferenceTrack } from '../types/music'

const ATTACK_SECONDS = 0.015
const RELEASE_SECONDS = 0.04

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
