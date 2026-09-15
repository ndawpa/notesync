import { useEffect, useRef } from 'react'
import { clefLabel, closestRhythmFigure, ledgerLinePositions, midiToStaffStep, resolveClef, splitIntoRhythmFigures, staffBottomStep, writtenMidiForClef, type Clef, type ClefPreference, type KeySignaturePreference } from '../music/notationUtils'
import { midiToDisplayName } from '../music/noteUtils'
import { trackDuration } from '../music/referenceTrack'
import type { NoteNaming, ReferenceNote, ReferenceTrack } from '../types/music'

interface Props { track: ReferenceTrack; elapsed: number; running: boolean; naming: NoteNaming; clefPreference: ClefPreference; keySignaturePreference: KeySignaturePreference; selectedNoteId?: string; onSelectNote: (id: string) => void }

const BEAT_WIDTH = 78
const LEFT = 38
const GUIDE_WIDTH = 180
const BAR_NOTE_GAP = 14
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

function noteY(midi: number, clef: Clef, preferFlats = false) {
  return STAFF_BOTTOM - (midiToStaffStep(writtenMidiForClef(midi, clef), preferFlats) - staffBottomStep(clef)) * 6
}

const SHARP_STEPS = [3, 0, 4, 1, 5, 2, 6]
const FLAT_STEPS = [6, 2, 5, 1, 4, 0, 3]
const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11]

function accidentalForMidi(midi: number, fifths: number) {
  const preferFlats = fifths < 0
  const step = ((midiToStaffStep(midi, preferFlats) % 7) + 7) % 7
  const pitchClass = ((midi % 12) + 12) % 12
  let actual = pitchClass - NATURAL_PITCH_CLASSES[step]
  if (actual > 6) actual -= 12
  if (actual < -6) actual += 12
  const expected = fifths > 0 && SHARP_STEPS.slice(0, fifths).includes(step) ? 1 : fifths < 0 && FLAT_STEPS.slice(0, -fifths).includes(step) ? -1 : 0
  if (actual === expected) return ''
  if (actual === 0) return '♮'
  return actual > 0 ? '♯' : '♭'
}

function resolvedKeys(track: ReferenceTrack, preference: KeySignaturePreference) {
  if (preference === 'auto') return track.keySignatures?.length ? track.keySignatures : [{ time: 0, fifths: 0, mode: 'major' as const }]
  if (preference === 'none') return [{ time: 0, fifths: 0, mode: 'major' as const }]
  const [mode, rawFifths] = preference.split(':') as ['major' | 'minor', string]
  return [{ time: 0, fifths: Number(rawFifths), mode }]
}

function keySignatureYs(clef: Clef, fifths: number) {
  const trebleSharps = [77, 72, 79, 74, 69, 76, 71]
  const trebleFlats = [71, 76, 69, 74, 67, 72, 65]
  const bassSharps = [53, 48, 55, 50, 45, 52, 47]
  const bassFlats = [47, 52, 45, 50, 43, 48, 41]
  const midis = (clef === 'bass' ? (fifths > 0 ? bassSharps : bassFlats) : (fifths > 0 ? trebleSharps : trebleFlats)).slice(0, Math.abs(fifths))
  return midis.map((midi) => noteY(clef === 'treble8vb' ? midi - 12 : midi, clef))
}

function NoteGlyph({ note, track, naming, clef, fifths, beamed, selected, onSelect }: { note: ReferenceNote; track: ReferenceTrack; naming: NoteNaming; clef: Clef; fifths: number; beamed: boolean; selected: boolean; onSelect: () => void }) {
  const startBeat = beatAtTime(track, note.start)
  const beats = beatAtTime(track, note.start + note.duration) - startBeat
  const figure = closestRhythmFigure(beats)
  const x = LEFT + startBeat * BEAT_WIDTH
  const y = noteY(note.midi, clef, fifths < 0)
  const ledgerLines = ledgerLinePositions(y, STAFF_TOP, STAFF_BOTTOM, 12)
  const dotted = figure.name.includes('pontuada')
  const visibleLabel = naming === 'lyrics' ? note.lyric : midiToDisplayName(note.midi, naming, false, fifths < 0)
  return <g className={`score-note ${selected ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`Editar ${note.lyric && naming === 'lyrics' ? `${note.lyric}, ` : ''}${midiToDisplayName(note.midi, 'letter', true, fifths < 0)}, ${figure.name}`} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }}>
    {ledgerLines.map((lineY) => <line key={lineY} className="ledger-line" x1={x - 12} x2={x + 12} y1={lineY} y2={lineY} />)}
    {accidentalForMidi(note.midi, fifths) && <text className="accidental" x={x - 18} y={y + 5}>{accidentalForMidi(note.midi, fifths)}</text>}
    <ellipse className={figure.filled ? 'note-head filled' : 'note-head'} cx={x} cy={y} rx="8" ry="5" transform={`rotate(-18 ${x} ${y})`} />
    {figure.stem && <line className="note-stem" x1={x + 7} x2={x + 7} y1={y} y2={y - 31} />}
    {!beamed && Array.from({ length: figure.flags }, (_, index) => <path key={index} className="note-flag" d={`M ${x + 7} ${y - 31 + index * 8} q 17 8 8 20`} />)}
    {dotted && <circle className="duration-dot" cx={x + 14} cy={y} r="2.5" />}
    {naming !== 'hidden' && <text className="score-note-name" x={x} y={132} textAnchor="middle">{visibleLabel}</text>}
  </g>
}

export function SheetMusic({ track, elapsed, running, naming, clefPreference, keySignaturePreference, selectedNoteId, onSelectNote }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const duration = trackDuration(track)
  const totalBeats = Math.max(4, beatAtTime(track, duration))
  const width = Math.max(760, Math.ceil(LEFT + totalBeats * BEAT_WIDTH + 50))
  const playheadX = LEFT + beatAtTime(track, elapsed) * BEAT_WIDTH
  const notation = notationLayout(track, totalBeats)
  const clef = resolveClef(clefPreference, track.notes.map((note) => note.midi))
  const keys = resolvedKeys(track, keySignaturePreference).map((key) => ({ ...key, beat: beatAtTime(track, key.time) }))
  const keyAtTime = (time: number) => { let active = keys[0]; for (const key of keys) { if (key.time <= time + 0.001) active = key; else break } return active }
  const activeKey = keyAtTime(elapsed)
  const signatureAtTime = (time: number) => { let active = notation.signatures[0]; for (const signature of notation.signatures) { if (signature.time <= time + 0.001) active = signature; else break } return active }
  const activeSignature = signatureAtTime(elapsed)
  const rhythmicNotes = [...track.notes].sort((a, b) => a.start - b.start).map((note) => {
    const startBeat = beatAtTime(track, note.start)
    const endBeat = beatAtTime(track, note.start + note.duration)
    const key = keyAtTime(note.start)
    return { note, startBeat, endBeat, x: LEFT + startBeat * BEAT_WIDTH, y: noteY(note.midi, clef, key.fifths < 0), flags: closestRhythmFigure(endBeat - startBeat).flags }
  })
  const beamGroups: typeof rhythmicNotes[] = []
  let pendingGroup: typeof rhythmicNotes = []
  const flushBeamGroup = () => { if (pendingGroup.length > 1) beamGroups.push(pendingGroup); pendingGroup = [] }
  for (const current of rhythmicNotes) {
    if (!current.flags) { flushBeamGroup(); continue }
    let signature = notation.signatures[0]
    for (const candidate of notation.signatures) { if (candidate.beat <= current.startBeat + 0.001) signature = candidate; else break }
    const pulseBeats = signature.clocksPerClick ? signature.clocksPerClick / 24 : (signature.numerator > 3 && signature.numerator % 3 === 0 ? 1.5 : 4 / signature.denominator)
    const pulseIndex = Math.floor((current.startBeat - signature.beat + 0.001) / pulseBeats)
    const previous = pendingGroup.at(-1)
    let previousSignature = notation.signatures[0]
    if (previous) for (const candidate of notation.signatures) { if (candidate.beat <= previous.startBeat + 0.001) previousSignature = candidate; else break }
    const previousPulseBeats = previousSignature.clocksPerClick ? previousSignature.clocksPerClick / 24 : (previousSignature.numerator > 3 && previousSignature.numerator % 3 === 0 ? 1.5 : 4 / previousSignature.denominator)
    const previousPulseIndex = previous ? Math.floor((previous.startBeat - previousSignature.beat + 0.001) / previousPulseBeats) : -1
    if (previous && (Math.abs(previous.endBeat - current.startBeat) > 0.02 || previousSignature !== signature || previousPulseIndex !== pulseIndex)) flushBeamGroup()
    pendingGroup.push(current)
  }
  flushBeamGroup()
  const beamedNoteIds = new Set(beamGroups.flatMap((group) => group.map((item) => item.note.id)))
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
    <div className="score-body">
      <svg className="score-guide" width={GUIDE_WIDTH} height={HEIGHT} viewBox={`0 0 ${GUIDE_WIDTH} ${HEIGHT}`} aria-label={`Indicador fixo: ${clefLabel(clef)}, ${activeSignature.numerator}/${activeSignature.denominator}`}>
        <rect width={GUIDE_WIDTH} height={HEIGHT} />
        {Array.from({ length: 5 }, (_, index) => STAFF_TOP + index * 12).map((y) => <line key={y} className="staff-line" x1="0" x2={GUIDE_WIDTH} y1={y} y2={y} />)}
        {clef === 'bass' ? <text className="bass-clef" x="17" y="82">𝄢</text> : <g><text className="treble-clef" x="15" y="91">𝄞</text>{clef === 'treble8vb' && <text className="octave-mark" x="31" y="111">8</text>}</g>}
        <g className="key-signature" transform="translate(65 0)">{keySignatureYs(clef, activeKey.fifths).map((y, index) => <text key={index} x={index * 10} y={y + 6}>{activeKey.fifths > 0 ? '♯' : '♭'}</text>)}</g>
        <g className="time-signature" transform={`translate(${79 + Math.abs(activeKey.fifths) * 10} 0)`}><text x="0" y="62" textAnchor="middle">{activeSignature.numerator}</text><text x="0" y="83" textAnchor="middle">{activeSignature.denominator}</text></g>
      </svg>
      <div className="score-scroll" ref={scrollRef}>
        <svg className="sheet-music" width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-label="Partitura do exercício">
        {Array.from({ length: 5 }, (_, index) => STAFF_TOP + index * 12).map((y) => <line key={y} className="staff-line" x1="0" x2={width - 20} y1={y} y2={y} />)}
        {notation.bars.map((bar) => {
          const boundaryX = LEFT + bar.beat * BEAT_WIDTH
          const barX = boundaryX - BAR_NOTE_GAP
          return <g key={`${bar.beat}-${bar.measure}`}>{bar.beat > 0.001 && <line className="bar-line" x1={barX} x2={barX} y1={STAFF_TOP} y2={STAFF_BOTTOM} />}<text className="measure-number" x={bar.beat > 0.001 ? barX + 4 : boundaryX} y={STAFF_TOP - 9}>{bar.measure}</text></g>
        })}
        {rests.map((rest, index) => <text key={`${rest.beat}-${index}`} className="rest-symbol" x={LEFT + rest.beat * BEAT_WIDTH} y="73" textAnchor="middle" aria-label={`Pausa de ${rest.name}`}>{rest.symbol}</text>)}
        {track.notes.map((note) => <NoteGlyph key={note.id} note={note} track={track} naming={naming} clef={clef} fifths={keyAtTime(note.start).fifths} beamed={beamedNoteIds.has(note.id)} selected={selectedNoteId === note.id} onSelect={() => onSelectNote(note.id)} />)}
        {beamGroups.map((group, groupIndex) => <g className="note-beams" key={`beam-${groupIndex}`}>
          {group.slice(0, -1).map((item, index) => { const next = group[index + 1]; return <line key={`primary-${item.note.id}`} x1={item.x + 7} y1={item.y - 31} x2={next.x + 7} y2={next.y - 31} /> })}
          {group.map((item, index) => {
            if (item.flags < 2) return null
            const previous = group[index - 1], next = group[index + 1]
            if (next?.flags >= 2) return <line key={`secondary-${item.note.id}`} x1={item.x + 7} y1={item.y - 23} x2={next.x + 7} y2={next.y - 23} />
            if (previous?.flags >= 2) return null
            const hookDirection = next ? 1 : -1
            return <line key={`secondary-${item.note.id}`} x1={item.x + 7} y1={item.y - 23} x2={item.x + 7 + hookDirection * 12} y2={item.y - 23} />
          })}
        </g>)}
        <line className="playhead" x1={playheadX} x2={playheadX} y1="25" y2="160" />
        </svg>
      </div>
    </div>
  </section>
}
