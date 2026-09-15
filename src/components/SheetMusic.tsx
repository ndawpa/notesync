import { useEffect, useRef } from 'react'
import { closestRhythmFigure, isSharpMidi, midiToStaffStep, splitIntoRhythmFigures } from '../music/notationUtils'
import { midiToDisplayName } from '../music/noteUtils'
import { trackDuration } from '../music/referenceTrack'
import type { NoteNaming, ReferenceNote, ReferenceTrack } from '../types/music'

interface Props { track: ReferenceTrack; elapsed: number; running: boolean; naming: NoteNaming; selectedNoteId?: string; onSelectNote: (id: string) => void }

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

function noteY(midi: number) {
  const e4Step = midiToStaffStep(64)
  return STAFF_BOTTOM - (midiToStaffStep(midi) - e4Step) * 6
}

function NoteGlyph({ note, track, naming, selected, onSelect }: { note: ReferenceNote; track: ReferenceTrack; naming: NoteNaming; selected: boolean; onSelect: () => void }) {
  const startBeat = beatAtTime(track, note.start)
  const beats = beatAtTime(track, note.start + note.duration) - startBeat
  const figure = closestRhythmFigure(beats)
  const x = LEFT + startBeat * BEAT_WIDTH
  const y = noteY(note.midi)
  const dotted = figure.name.includes('pontuada')
  return <g className={`score-note ${selected ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`Editar ${midiToDisplayName(note.midi, naming)}, ${figure.name}`} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }}>
    {(y < STAFF_TOP || y > STAFF_BOTTOM) && <line className="ledger-line" x1={x - 12} x2={x + 12} y1={y} y2={y} />}
    {isSharpMidi(note.midi) && <text className="accidental" x={x - 18} y={y + 5}>♯</text>}
    <ellipse className={figure.filled ? 'note-head filled' : 'note-head'} cx={x} cy={y} rx="8" ry="5" transform={`rotate(-18 ${x} ${y})`} />
    {figure.stem && <line className="note-stem" x1={x + 7} x2={x + 7} y1={y} y2={y - 31} />}
    {Array.from({ length: figure.flags }, (_, index) => <path key={index} className="note-flag" d={`M ${x + 7} ${y - 31 + index * 8} q 17 8 8 20`} />)}
    {dotted && <circle className="duration-dot" cx={x + 14} cy={y} r="2.5" />}
    <text className="score-note-name" x={x} y={132} textAnchor="middle">{midiToDisplayName(note.midi, naming)}</text>
    <text className="rhythm-name" x={x} y={151} textAnchor="middle">{figure.name}</text>
  </g>
}

export function SheetMusic({ track, elapsed, running, naming, selectedNoteId, onSelectNote }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const duration = trackDuration(track)
  const totalBeats = Math.max(4, beatAtTime(track, duration))
  const width = Math.max(760, Math.ceil(LEFT + totalBeats * BEAT_WIDTH + 50))
  const playheadX = LEFT + beatAtTime(track, elapsed) * BEAT_WIDTH
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
    <div className="score-heading"><span>Clave de Sol</span><span>4/4 · duração quantizada pelo andamento</span></div>
    <div className="score-scroll" ref={scrollRef}>
      <svg className="sheet-music" width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-label="Partitura do exercício">
        <text className="treble-clef" x="15" y="91">𝄞</text>
        {Array.from({ length: 5 }, (_, index) => STAFF_TOP + index * 12).map((y) => <line key={y} className="staff-line" x1={LEFT - 15} x2={width - 20} y1={y} y2={y} />)}
        {Array.from({ length: Math.floor(totalBeats / 4) + 1 }, (_, index) => index * 4).map((beat) => <g key={beat}><line className="bar-line" x1={LEFT + beat * BEAT_WIDTH} x2={LEFT + beat * BEAT_WIDTH} y1={STAFF_TOP} y2={STAFF_BOTTOM} /><text className="measure-number" x={LEFT + beat * BEAT_WIDTH + 4} y={STAFF_TOP - 9}>{Math.floor(beat / 4) + 1}</text></g>)}
        {rests.map((rest, index) => <g key={`${rest.beat}-${index}`}><text className="rest-symbol" x={LEFT + rest.beat * BEAT_WIDTH} y="73" textAnchor="middle">{rest.symbol}</text><text className="rhythm-name" x={LEFT + rest.beat * BEAT_WIDTH} y="151" textAnchor="middle">pausa de {rest.name}</text></g>)}
        {track.notes.map((note) => <NoteGlyph key={note.id} note={note} track={track} naming={naming} selected={selectedNoteId === note.id} onSelect={() => onSelectNote(note.id)} />)}
        <line className="playhead" x1={playheadX} x2={playheadX} y1="25" y2="160" />
      </svg>
    </div>
  </section>
}
