import type { PitchFrame } from '../types/audio'
import type { NoteNaming, ReferenceNote } from '../types/music'
import { midiToDisplayName } from '../music/noteUtils'
import { pitchStatus } from '../scoring/pitchScoring'

interface Props { expected?: ReferenceNote; detected?: PitchFrame; differenceCents?: number; volume: number; naming: NoteNaming }

export function CurrentNote({ expected, detected, differenceCents, volume, naming }: Props) {
  const status = differenceCents === undefined ? 'Aguardando voz' : pitchStatus(differenceCents)
  const direction = differenceCents === undefined || Math.abs(differenceCents) <= 20 ? '' : differenceCents > 0 ? ' • acima' : ' • abaixo'
  return <section className="current-card" aria-live="polite">
    <div><span>Nota esperada</span><strong>{expected ? midiToDisplayName(expected.midi, naming) : '—'}</strong></div>
    <div><span>Nota detectada</span><strong>{detected ? midiToDisplayName(Math.round(detected.midi), naming) : '—'}</strong></div>
    <div><span>Diferença</span><strong>{differenceCents === undefined ? '—' : `${differenceCents > 0 ? '+' : ''}${differenceCents.toFixed(1)} cents`}</strong></div>
    <div><span>Status</span><strong className={`status ${status.toLowerCase().replace(' ', '-')}`}>{status.toUpperCase()}{direction}</strong></div>
    <div><span>Frequência</span><strong>{detected ? `${detected.frequency.toFixed(1)} Hz` : '—'}</strong></div>
    <div><span>Pitch confidence</span><strong>{detected ? `${Math.round(detected.confidence * 100)}%` : '—'}</strong></div>
    <div className="volume"><span>Volume</span><meter min="0" max="0.15" value={Math.min(volume, 0.15)} /><small>{Math.round(volume * 1000)}</small></div>
  </section>
}
