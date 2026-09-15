import { useEffect, useRef } from 'react'
import { clefLabel, closestRhythmFigure, isSharpMidi, ledgerLinePositions, midiToStaffStep, resolveClef, splitIntoRhythmFigures, staffBottomStep, writtenMidiForClef, type Clef, type ClefPreference } from '../music/notationUtils'
import { midiToDisplayName } from '../music/noteUtils'
import { trackDuration } from '../music/referenceTrack'
import type { NoteNaming, ReferenceNote, ReferenceTrack } from '../types/music'

interface Props { track: ReferenceTrack; elapsed: number; running: boolean; naming: NoteNaming; clefPreference: ClefPreference; selectedNoteId?: string; onSelectNote: (id: string) => void }

const BEAT_WIDTH = 78
const LEFT = 72
const STAFF_TOP = 42
const STAFF_BOTTOM = 90
const HEIGHT = 190

function beatAtTime(track: ReferenceTrack, target: number) {
  const tempos = track.tempoChanges?.length ? track.tempoChanges : [{ time: 0, bpm: track.bpm ?? 60 }]
  let beats = 0
  for (let index = 0; index < tempos.length; index++) {
    const tempo = tempos[index]
    if (tempo.time >= target) break
    const end = Math.min(target, tempos[index + 1]?.time ?? target)
    beats += Math.max(0, end - tempo.time) * tempo.bpm / 60
    if (end === target) break
  }
  return beats
}

function notationLayout(track: ReferenceTrack, totalBeats: number) {
  const signatures = (track.timeSignatures?.length ? track.timeSignatures : [{ time: 0, numerator: 4, denominator: 4 }])
    .map((signature) => ({ ...signature, beat: beatAtTime(track, signature.time) }))
    .filter((signature) => signature.beat <= totalBeats + 0.001)
    .sort((a, b) => a.beat - b.beat)
  const bars: Array<{ beat: number; measure: number }> = []
  let measure = 1
  for (let index = 0; index < signatures.length; index++) {
    const signature = signatures[index]
    const endBeat = Math.min(totalBeats, signatures[index + 1]?.beat ?? totalBeats)
    bars.push({ beat: signature.beat, measure })
    const measureBeats = signature.numerator * 4 / signature.denominator
    for (let beat = signature.beat + measureBeats; beat <= endBeat + 0.001; beat += measureBeats) {
      if (beat >= endBeat - 0.001 && index < signatures.length - 1) break
      measure += 1
      bars.push({ beat, measure })
    }
    if (index < signatures.length - 1) measure += 1
  }
  return { signatures, bars: bars.filter((bar, index) => index === 0 || Math.abs(bar.beat - bars[index - 1].beat) > 0.001) }
}

function noteY(midi: number, clef: Clef) {
  return STAFF_BOTTOM - (midiToStaffStep(writtenMidiForClef(midi, clef)) - staffBottomStep(clef)) * 6
}

function NoteGlyph({ note, track, naming, clef, selected, onSelect }: { note: ReferenceNote; track: ReferenceTrack; naming: NoteNaming; clef: Clef; selected: boolean; onSelect: () => void }) {
  const startBeat = beatAtTime(track, note.start)
  const beats = beatAtTime(track, note.start + note.duration) - startBeat
  const figure = closestRhythmFigure(beats)
  const x = LEFT + startBeat * BEAT_WIDTH
  const y = noteY(note.midi, clef)
  const ledgerLines = ledgerLinePositions(y, STAFF_TOP, STAFF_BOTTOM, 12)
  const dotted = figure.name.includes('pontuada')
  const visibleLabel = naming === 'lyrics' ? note.lyric : midiToDisplayName(note.midi, naming, false)
  return <g className={`score-note ${selected ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`Editar ${note.lyric && naming === 'lyrics' ? `${note.lyric}, ` : ''}${midiToDisplayName(note.midi, 'letter')}, ${figure.name}`} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }}>
    {ledgerLines.map((lineY) => <line key={lineY} className="ledger-line" x1={x - 12} x2={x + 12} y1={lineY} y2={lineY} />)}
    {isSharpMidi(note.midi) && <text className="accidental" x={x - 18} y={y + 5}>♯</text>}
    <ellipse className={figure.filled ? 'note-head filled' : 'note-head'} cx={x} cy={y} rx="8" ry="5" transform={`rotate(-18 ${x} ${y})`} />
    {figure.stem && <line className="note-stem" x1={x + 7} x2={x + 7} y1={y} y2={y - 31} />}
    {Array.from({ length: figure.flags }, (_, index) => <path key={index} className="note-flag" d={`M ${x + 7} ${y - 31 + index * 8} q 17 8 8 20`} />)}
    {dotted && <circle className="duration-dot" cx={x + 14} cy={y} r="2.5" />}
    {naming !== 'hidden' && <text className="score-note-name" x={x} y={132} textAnchor="middle">{visibleLabel}</text>}
  </g>
}

export function SheetMusic({ track, elapsed, running, naming, clefPreference, selectedNoteId, onSelectNote }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const duration = trackDuration(track)
  const totalBeats = Math.max(4, beatAtTime(track, duration))
  const width = Math.max(760, Math.ceil(LEFT + totalBeats * BEAT_WIDTH + 50))
  const playheadX = LEFT + beatAtTime(track, elapsed) * BEAT_WIDTH
  const notation = notationLayout(track, totalBeats)
  const clef = resolveClef(clefPreference, track.notes.map((note) => note.midi))
  const rests: Array<{ beat: number; name: string; symbol: string }> = []
  let cursorTime = 0
  for (const note of [...track.notes].sort((a, b) => a.start - b.start)) {
    if (note.start > cursorTime + 0.02) {
      let beat = beatAtTime(track, cursorTime)
      const gapBeats = beatAtTime(track, note.start) - beat
      for (const figure of splitIntoRhythmFigures(gapBeats)) { rests.push({ beat: beat + figure.beats / 2, name: figure.name, symbol: figure.restSymbol }); beat += figure.beats }
    }
    cursorTime = Math.max(cursorTime, note.start + note.duration)
  }

  useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport) return
    if (elapsed === 0) { viewport.scrollLeft = 0; return }
    if (running) viewport.scrollLeft = Math.max(0, Math.min(playheadX - viewport.clientWidth * 0.35, viewport.scrollWidth - viewport.clientWidth))
  }, [elapsed, playheadX, running])

  return <section className="score-panel-view">
    <div className="score-heading"><span>{clefLabel(clef)}{clefPreference === 'auto' ? ' · automática' : ''}</span><span>{notation.signatures.map((signature) => `${signature.numerator}/${signature.denominator}`).join(' → ')} · duração quantizada pelo andamento</span></div>
    <div className="score-scroll" ref={scrollRef}>
      <svg className="sheet-music" width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-label="Partitura do exercício">
        {clef === 'bass' ? <text className="bass-clef" x="17" y="82">𝄢</text> : <g><text className="treble-clef" x="15" y="91">𝄞</text>{clef === 'treble8vb' && <text className="octave-mark" x="31" y="111">8</text>}</g>}
        {Array.from({ length: 5 }, (_, index) => STAFF_TOP + index * 12).map((y) => <line key={y} className="staff-line" x1={LEFT - 15} x2={width - 20} y1={y} y2={y} />)}
        {notation.bars.map((bar) => <g key={`${bar.beat}-${bar.measure}`}><line className="bar-line" x1={LEFT + bar.beat * BEAT_WIDTH} x2={LEFT + bar.beat * BEAT_WIDTH} y1={STAFF_TOP} y2={STAFF_BOTTOM} /><text className="measure-number" x={LEFT + bar.beat * BEAT_WIDTH + 4} y={STAFF_TOP - 9}>{bar.measure}</text></g>)}
        {notation.signatures.map((signature, index) => <g key={`${signature.beat}-${signature.numerator}/${signature.denominator}`} className="time-signature" transform={`translate(${LEFT + signature.beat * BEAT_WIDTH + (index === 0 ? -11 : 8)} 0)`}><text x="0" y="62" textAnchor="middle">{signature.numerator}</text><text x="0" y="83" textAnchor="middle">{signature.denominator}</text></g>)}
        {rests.map((rest, index) => <text key={`${rest.beat}-${index}`} className="rest-symbol" x={LEFT + rest.beat * BEAT_WIDTH} y="73" textAnchor="middle" aria-label={`Pausa de ${rest.name}`}>{rest.symbol}</text>)}
        {track.notes.map((note) => <NoteGlyph key={note.id} note={note} track={track} naming={naming} clef={clef} selected={selectedNoteId === note.id} onSelect={() => onSelectNote(note.id)} />)}
        <line className="playhead" x1={playheadX} x2={playheadX} y1="25" y2="160" />
      </svg>
    </div>
  </section>
}
