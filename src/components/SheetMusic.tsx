import { useEffect, useRef } from 'react'
import { clefLabel, closestRhythmFigure, ledgerLinePositions, midiToStaffStep, positionInsideMeasure, resolveClef, splitIntoRhythmFigures, staffBottomStep, writtenMidiForClef, type Clef, type ClefPreference, type KeySignaturePreference } from '../music/notationUtils'
import { midiToDisplayName } from '../music/noteUtils'
import { trackDuration } from '../music/referenceTrack'
import type { NoteNaming, ReferenceNote, ReferenceTrack, ScoreLayout } from '../types/music'

interface Props { track: ReferenceTrack; elapsed: number; running: boolean; naming: NoteNaming; clefPreference: ClefPreference; keySignaturePreference: KeySignaturePreference; layout: ScoreLayout; selectedNoteId?: string; onSelectNote: (id: string) => void }

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

function accidentalInfo(midi: number, fifths: number) {
  const preferFlats = fifths < 0
  const step = ((midiToStaffStep(midi, preferFlats) % 7) + 7) % 7
  const pitchClass = ((midi % 12) + 12) % 12
  let actual = pitchClass - NATURAL_PITCH_CLASSES[step]
  if (actual > 6) actual -= 12
  if (actual < -6) actual += 12
  const expected = fifths > 0 && SHARP_STEPS.slice(0, fifths).includes(step) ? 1 : fifths < 0 && FLAT_STEPS.slice(0, -fifths).includes(step) ? -1 : 0
  return { actual, expected, symbol: actual === expected ? '' : actual === 0 ? '♮' : actual > 0 ? '♯' : '♭' }
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

function NoteGlyph({ note, track, naming, clef, fifths, accidental, stemDown, beamed, active, selected, onSelect }: { note: ReferenceNote; track: ReferenceTrack; naming: NoteNaming; clef: Clef; fifths: number; accidental: string; stemDown: boolean; beamed: boolean; active: boolean; selected: boolean; onSelect: () => void }) {
  const startBeat = beatAtTime(track, note.start)
  const beats = beatAtTime(track, note.start + note.duration) - startBeat
  const figure = closestRhythmFigure(beats)
  const x = LEFT + startBeat * BEAT_WIDTH
  const y = noteY(note.midi, clef, fifths < 0)
  const ledgerLines = ledgerLinePositions(y, STAFF_TOP, STAFF_BOTTOM, 12)
  const dotted = figure.name.includes('pontuada')
  const visibleLabel = naming === 'lyrics' ? note.lyric : midiToDisplayName(note.midi, naming, false, fifths < 0)
  return <g className={`score-note ${selected ? 'selected' : ''} ${active ? 'active' : ''}`} role="button" tabIndex={0} aria-label={`Editar ${note.lyric && naming === 'lyrics' ? `${note.lyric}, ` : ''}${midiToDisplayName(note.midi, 'letter', true, fifths < 0)}, ${figure.name}`} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }}>
    {ledgerLines.map((lineY) => <line key={lineY} className="ledger-line" x1={x - 12} x2={x + 12} y1={lineY} y2={lineY} />)}
    {accidental && <text className="accidental" x={x - 18} y={y + 5}>{accidental}</text>}
    <ellipse className={figure.filled ? 'note-head filled' : 'note-head'} cx={x} cy={y} rx="8" ry="5" transform={`rotate(-18 ${x} ${y})`} />
    {figure.stem && <line className="note-stem" x1={x + (stemDown ? -7 : 7)} x2={x + (stemDown ? -7 : 7)} y1={y} y2={y + (stemDown ? 31 : -31)} />}
    {!beamed && Array.from({ length: figure.flags }, (_, index) => <path key={index} className="note-flag" d={stemDown ? `M ${x - 7} ${y + 31 - index * 8} q -17 -8 -8 -20` : `M ${x + 7} ${y - 31 + index * 8} q 17 8 8 20`} />)}
    {dotted && <circle className="duration-dot" cx={x + 14} cy={y} r="2.5" />}
    {naming !== 'hidden' && <text className="score-note-name" x={x} y={132} textAnchor="middle">{visibleLabel}</text>}
  </g>
}

function WrappedScore({ track, elapsed, running, naming, clefPreference, keySignaturePreference, selectedNoteId, onSelectNote }: Omit<Props, 'layout'>) {
  const totalBeats = Math.max(4, beatAtTime(track, trackDuration(track)))
  const notation = notationLayout(track, totalBeats), clef = resolveClef(clefPreference, track.notes.map((note) => note.midi))
  const keys = resolvedKeys(track, keySignaturePreference).map((key) => ({ ...key, beat: beatAtTime(track, key.time) }))
  const keyAtBeat = (beat: number) => { let active = keys[0]; for (const key of keys) { if (key.beat <= beat + 0.001) active = key; else break } return active }
  const signatureAtBeat = (beat: number) => { let active = notation.signatures[0]; for (const signature of notation.signatures) { if (signature.beat <= beat + 0.001) active = signature; else break } return active }
  const boundaries = [...new Set([...notation.bars.map((bar) => Number(bar.beat.toFixed(6))), Number(totalBeats.toFixed(6))])].sort((a, b) => a - b)
  const systems = Array.from({ length: Math.ceil((boundaries.length - 1) / 4) }, (_, systemIndex) => {
    const firstBoundary = systemIndex * 4, startBeat = boundaries[firstBoundary], endBeat = boundaries[Math.min(boundaries.length - 1, firstBoundary + 4)]
    return { firstBoundary, startBeat, endBeat, bars: notation.bars.filter((bar) => bar.beat >= startBeat - 0.001 && bar.beat < endBeat - 0.001) }
  })
  const activeId = running ? track.notes.find((note) => elapsed >= note.start && elapsed < note.start + note.duration)?.id : undefined
  const rests: Array<{ beat: number; name: string; symbol: string }> = []
  let restCursor = 0
  for (const note of [...track.notes].sort((a, b) => a.start - b.start)) {
    if (note.start > restCursor + 0.02) {
      let beat = beatAtTime(track, restCursor)
      const gapEnd = beatAtTime(track, note.start)
      while (beat < gapEnd - 0.01) {
        const nextBar = boundaries.find((boundary) => boundary > beat + 0.01) ?? gapEnd
        const segmentEnd = Math.min(gapEnd, nextBar)
        for (const figure of splitIntoRhythmFigures(segmentEnd - beat)) { rests.push({ beat: beat + figure.beats / 2, name: figure.name, symbol: figure.restSymbol }); beat += figure.beats }
        if (segmentEnd - beat < 0.125) beat = segmentEnd
      }
    }
    restCursor = Math.max(restCursor, note.start + note.duration)
  }
  const tiePairs = [...track.notes].sort((a, b) => a.start - b.start).flatMap((note, index, notes) => {
    if (!note.tieStart) return []
    const next = notes.slice(index + 1).find((candidate) => candidate.midi === note.midi && candidate.tieStop)
    return next ? [{ from: note, to: next }] : []
  })
  return <section className="score-panel-view wrapped-score"><div className="score-heading"><span>{clefLabel(clef)} · sistemas</span><span>{systems.length} sistema(s)</span></div>{systems.map((system, systemIndex) => {
    const key = keyAtBeat(system.startBeat), signature = signatureAtBeat(system.startBeat), span = Math.max(1, system.endBeat - system.startBeat)
    const contentStart = Math.max(145, 125 + Math.abs(key.fifths) * 9)
    const boundaryX = (beat: number) => contentStart + (beat - system.startBeat) / span * (842 - contentStart)
    const systemBoundaries = boundaries.slice(system.firstBoundary, Math.min(boundaries.length, system.firstBoundary + 5))
    const noteX = (beat: number) => {
      let measureIndex = systemBoundaries.findIndex((boundary, index) => index < systemBoundaries.length - 1 && beat >= boundary - 0.001 && beat < systemBoundaries[index + 1] - 0.001)
      if (measureIndex < 0) measureIndex = Math.max(0, systemBoundaries.length - 2)
      const start = systemBoundaries[measureIndex], end = systemBoundaries[measureIndex + 1] ?? system.endBeat
      return positionInsideMeasure(beat, start, end, boundaryX(start), boundaryX(end), 24)
    }
    const items = [...track.notes].sort((a, b) => a.start - b.start).filter((note) => { const beat = beatAtTime(track, note.start); return beat >= system.startBeat - 0.001 && beat < system.endBeat - 0.001 }).map((note) => {
      const beat = beatAtTime(track, note.start), endBeat = beatAtTime(track, note.start + note.duration), noteKey = keyAtBeat(beat), y = noteY(note.midi, clef, noteKey.fifths < 0), stemDown = y < 66, x = noteX(beat)
      return { note, beat, endBeat, key: noteKey, x, y, stemDown, stemX: x + (stemDown ? -7 : 7), stemEndY: y + (stemDown ? 31 : -31), figure: closestRhythmFigure(endBeat - beat) }
    })
    const accidentals = new Map<string, string>(), accidentalState = new Map<string, number>()
    for (const item of items) {
      const info = accidentalInfo(item.note.midi, item.key.fifths)
      const measureIndex = Math.max(0, systemBoundaries.findIndex((boundary, index) => index < systemBoundaries.length - 1 && item.beat >= boundary - 0.001 && item.beat < systemBoundaries[index + 1] - 0.001))
      const stateKey = `${measureIndex}:${midiToStaffStep(writtenMidiForClef(item.note.midi, clef), item.key.fifths < 0)}`, previous = accidentalState.get(stateKey)
      const symbol = previous === info.actual ? '' : info.symbol || (previous !== undefined && info.actual === info.expected ? (info.actual === 0 ? '♮' : info.actual > 0 ? '♯' : '♭') : '')
      accidentals.set(item.note.id, symbol); accidentalState.set(stateKey, info.actual)
    }
    const beamGroups: Array<typeof items> = [], beamedIds = new Set<string>()
    let pending: typeof items = []
    const flush = () => { if (pending.length > 1) { beamGroups.push(pending); pending.forEach((item) => beamedIds.add(item.note.id)) }; pending = [] }
    for (const item of items) {
      if (!item.figure.flags) { flush(); continue }
      const itemSignature = signatureAtBeat(item.beat), pulse = itemSignature.clocksPerClick ? itemSignature.clocksPerClick / 24 : (itemSignature.numerator > 3 && itemSignature.numerator % 3 === 0 ? 1.5 : 4 / itemSignature.denominator)
      const pulseIndex = Math.floor((item.beat - itemSignature.beat + 0.001) / pulse), previous = pending.at(-1)
      if (previous) {
        const previousSignature = signatureAtBeat(previous.beat), previousPulse = previousSignature.clocksPerClick ? previousSignature.clocksPerClick / 24 : (previousSignature.numerator > 3 && previousSignature.numerator % 3 === 0 ? 1.5 : 4 / previousSignature.denominator)
        const previousPulseIndex = Math.floor((previous.beat - previousSignature.beat + 0.001) / previousPulse)
        if (Math.abs(previous.endBeat - item.beat) > 0.02 || previousSignature !== itemSignature || previousPulseIndex !== pulseIndex || previous.stemDown !== item.stemDown) flush()
      }
      pending.push(item)
    }
    flush()
    const tupletGroups: Array<typeof items> = []
    let tupletPending: typeof items = []
    const flushTuplet = () => { if (tupletPending.length) tupletGroups.push(tupletPending); tupletPending = [] }
    for (const item of items) {
      const previous = tupletPending.at(-1)
      if (!item.note.tuplet) { flushTuplet(); continue }
      if (previous && (previous.note.tuplet?.actual !== item.note.tuplet.actual || previous.note.tuplet.normal !== item.note.tuplet.normal || Math.abs(previous.endBeat - item.beat) > 0.02)) flushTuplet()
      tupletPending.push(item)
      if (tupletPending.length >= item.note.tuplet.actual) flushTuplet()
    }
    flushTuplet()
    const currentBeat = beatAtTime(track, elapsed), playhead = currentBeat >= system.startBeat && currentBeat < system.endBeat ? noteX(currentBeat) : undefined
    return <svg key={systemIndex} className="score-system" viewBox="0 0 860 165" aria-label={`Sistema ${systemIndex + 1}`}>
      {Array.from({ length: 5 }, (_, index) => STAFF_TOP + index * 12).map((y) => <line key={y} className="staff-line" x1="18" x2="842" y1={y} y2={y} />)}
      {clef === 'bass' ? <text className="bass-clef" x="25" y="82">𝄢</text> : <g><text className="treble-clef" x="23" y="91">𝄞</text>{clef === 'treble8vb' && <text className="octave-mark" x="40" y="111">8</text>}</g>}
      <g className="key-signature" transform="translate(73 0)">{keySignatureYs(clef, key.fifths).map((y, index) => <text key={index} x={index * 9} y={y + 6}>{key.fifths > 0 ? '♯' : '♭'}</text>)}</g>
      <g className="time-signature" transform={`translate(${91 + Math.abs(key.fifths) * 9} 0)`}><text y="62">{signature.numerator}</text><text y="83">{signature.denominator}</text></g>
      {system.bars.map((bar) => <g key={bar.measure}><line className="bar-line" x1={boundaryX(bar.beat)} x2={boundaryX(bar.beat)} y1={STAFF_TOP} y2={STAFF_BOTTOM}/><text className="measure-number" x={boundaryX(bar.beat) + 4} y={STAFF_TOP - 9}>{bar.measure}</text></g>)}
      {rests.filter((rest) => rest.beat >= system.startBeat && rest.beat < system.endBeat).map((rest, index) => <text key={`${rest.beat}-${index}`} className="rest-symbol" x={noteX(rest.beat)} y="73" textAnchor="middle" aria-label={`Pausa de ${rest.name}`}>{rest.symbol}</text>)}
      {items.map((item) => { const { note, x, y, figure, stemDown } = item, active = note.id === activeId; return <g key={note.id} className={`score-note ${active ? 'active' : ''} ${note.id === selectedNoteId ? 'selected' : ''}`} role="button" tabIndex={0} onClick={() => onSelectNote(note.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectNote(note.id) }}>
        {ledgerLinePositions(y, STAFF_TOP, STAFF_BOTTOM, 12).map((lineY) => <line key={lineY} className="ledger-line" x1={x - 11} x2={x + 11} y1={lineY} y2={lineY}/>)}
        {accidentals.get(note.id) && <text className="accidental" x={x - 18} y={y + 5}>{accidentals.get(note.id)}</text>}
        <ellipse className={figure.filled ? 'note-head filled' : 'note-head'} cx={x} cy={y} rx="8" ry="5" transform={`rotate(-18 ${x} ${y})`}/>
        {figure.stem && <line className="note-stem" x1={item.stemX} x2={item.stemX} y1={y} y2={item.stemEndY}/>}
        {!beamedIds.has(note.id) && Array.from({ length: figure.flags }, (_, index) => <path key={index} className="note-flag" d={stemDown ? `M ${x - 7} ${y + 31 - index * 8} q -17 -8 -8 -20` : `M ${x + 7} ${y - 31 + index * 8} q 17 8 8 20`}/>)}
        {figure.name.includes('pontuada') && <circle className="duration-dot" cx={x + 14} cy={y} r="2.5"/>}
        {naming !== 'hidden' && <text className="score-note-name" x={x} y="132" textAnchor="middle">{naming === 'lyrics' ? note.lyric : midiToDisplayName(note.midi, naming, false, item.key.fifths < 0)}</text>}
      </g>})}
      {beamGroups.map((group, groupIndex) => <g className="note-beams" key={`system-beam-${groupIndex}`}>{group.slice(0, -1).map((item, index) => { const next = group[index + 1]; return <line className={activeId === item.note.id || activeId === next.note.id ? 'active' : ''} key={item.note.id} x1={item.stemX} y1={item.stemEndY} x2={next.stemX} y2={next.stemEndY}/> })}{group.map((item, index) => { if (item.figure.flags < 2) return null; const next = group[index + 1], previous = group[index - 1], offset = item.stemDown ? -8 : 8; if (next?.figure.flags >= 2) return <line key={`secondary-${item.note.id}`} x1={item.stemX} y1={item.stemEndY + offset} x2={next.stemX} y2={next.stemEndY + offset}/>; if (previous?.figure.flags >= 2) return null; return <line key={`hook-${item.note.id}`} x1={item.stemX} y1={item.stemEndY + offset} x2={item.stemX + (next ? 12 : -12)} y2={item.stemEndY + offset}/> })}</g>)}
      {tiePairs.map((tie) => { const fromBeat = beatAtTime(track, tie.from.start), toBeat = beatAtTime(track, tie.to.start), fromHere = fromBeat >= system.startBeat && fromBeat < system.endBeat, toHere = toBeat >= system.startBeat && toBeat < system.endBeat; if (!fromHere && !toHere) return null; const y = noteY(tie.from.midi, clef, key.fifths < 0), fromX = fromHere ? noteX(fromBeat) + 7 : boundaryX(system.startBeat) + 4, toX = toHere ? noteX(toBeat) - 7 : boundaryX(system.endBeat) - 4; return <path key={`system-tie-${tie.from.id}`} className="note-tie" d={`M ${fromX} ${y + 9} Q ${(fromX + toX) / 2} ${y + 21} ${toX} ${y + 9}`}/> })}
      {tupletGroups.map((group, index) => { const first = group[0], last = group.at(-1)!, center = (first.x + last.x) / 2, y = Math.max(15, Math.min(...group.map((item) => item.stemEndY)) - 8); return <g className="tuplet-bracket" key={`tuplet-${index}`}><line x1={first.x - 5} x2={center - 8} y1={y} y2={y}/><text className="tuplet-number" x={center} y={y + 4} textAnchor="middle">{first.note.tuplet!.actual}</text><line x1={center + 8} x2={last.x + 5} y1={y} y2={y}/></g> })}
      {playhead !== undefined && <line className="playhead" x1={playhead} x2={playhead} y1="25" y2="145"/>}
      <line className="bar-line" x1={boundaryX(system.endBeat)} x2={boundaryX(system.endBeat)} y1={STAFF_TOP} y2={STAFF_BOTTOM}/>
    </svg>
  })}</section>
}

export function SheetMusic({ track, elapsed, running, naming, clefPreference, keySignaturePreference, layout, selectedNoteId, onSelectNote }: Props) {
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
  const activeNoteId = running ? track.notes.find((note) => elapsed >= note.start && elapsed < note.start + note.duration)?.id : undefined
  const rhythmicNotes = [...track.notes].sort((a, b) => a.start - b.start).map((note) => {
    const startBeat = beatAtTime(track, note.start)
    const endBeat = beatAtTime(track, note.start + note.duration)
    const key = keyAtTime(note.start)
    const y = noteY(note.midi, clef, key.fifths < 0)
    const stemDown = y < (STAFF_TOP + STAFF_BOTTOM) / 2
    return { note, startBeat, endBeat, x: LEFT + startBeat * BEAT_WIDTH, y, stemDown, stemX: LEFT + startBeat * BEAT_WIDTH + (stemDown ? -7 : 7), stemEndY: y + (stemDown ? 31 : -31), flags: closestRhythmFigure(endBeat - startBeat).flags }
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
    if (previous && (Math.abs(previous.endBeat - current.startBeat) > 0.02 || previousSignature !== signature || previousPulseIndex !== pulseIndex || previous.stemDown !== current.stemDown)) flushBeamGroup()
    pendingGroup.push(current)
  }
  flushBeamGroup()
  const beamedNoteIds = new Set(beamGroups.flatMap((group) => group.map((item) => item.note.id)))
  const accidentals = new Map<string, string>()
  const accidentalState = new Map<string, number>()
  for (const item of rhythmicNotes) {
    const key = keyAtTime(item.note.start), info = accidentalInfo(item.note.midi, key.fifths)
    let measure = 1
    for (const bar of notation.bars) { if (bar.beat <= item.startBeat + 0.001) measure = bar.measure; else break }
    const stateKey = `${measure}:${midiToStaffStep(writtenMidiForClef(item.note.midi, clef), key.fifths < 0)}`
    const previous = accidentalState.get(stateKey)
    const symbol = previous === info.actual ? '' : info.symbol || (previous !== undefined && info.actual === info.expected ? (info.actual === 0 ? '♮' : info.actual > 0 ? '♯' : '♭') : '')
    accidentals.set(item.note.id, symbol); accidentalState.set(stateKey, info.actual)
  }
  const ties = rhythmicNotes.flatMap((item, index) => {
    if (!item.note.tieStart) return []
    const next = rhythmicNotes.slice(index + 1).find((candidate) => candidate.note.midi === item.note.midi && candidate.note.tieStop)
    return next ? [{ from: item, to: next }] : []
  })
  const tuplets = rhythmicNotes.filter((item, index, list) => item.note.tuplet && (index === 0 || list[index - 1].note.tuplet?.actual !== item.note.tuplet.actual || Math.abs(list[index - 1].endBeat - item.startBeat) > 0.02))
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

  if (layout === 'systems') return <WrappedScore track={track} elapsed={elapsed} running={running} naming={naming} clefPreference={clefPreference} keySignaturePreference={keySignaturePreference} selectedNoteId={selectedNoteId} onSelectNote={onSelectNote} />

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
        {track.notes.map((note) => { const item = rhythmicNotes.find((candidate) => candidate.note.id === note.id)!; return <NoteGlyph key={note.id} note={note} track={track} naming={naming} clef={clef} fifths={keyAtTime(note.start).fifths} accidental={accidentals.get(note.id) ?? ''} stemDown={item.stemDown} beamed={beamedNoteIds.has(note.id)} active={activeNoteId === note.id} selected={selectedNoteId === note.id} onSelect={() => onSelectNote(note.id)} /> })}
        {beamGroups.map((group, groupIndex) => <g className="note-beams" key={`beam-${groupIndex}`}>
          {group.slice(0, -1).map((item, index) => { const next = group[index + 1]; return <line className={activeNoteId === item.note.id || activeNoteId === next.note.id ? 'active' : ''} key={`primary-${item.note.id}`} x1={item.stemX} y1={item.stemEndY} x2={next.stemX} y2={next.stemEndY} /> })}
          {group.map((item, index) => {
            if (item.flags < 2) return null
            const previous = group[index - 1], next = group[index + 1]
            const secondaryOffset = item.stemDown ? -8 : 8
            if (next?.flags >= 2) return <line className={activeNoteId === item.note.id || activeNoteId === next.note.id ? 'active' : ''} key={`secondary-${item.note.id}`} x1={item.stemX} y1={item.stemEndY + secondaryOffset} x2={next.stemX} y2={next.stemEndY + secondaryOffset} />
            if (previous?.flags >= 2) return null
            const hookDirection = next ? 1 : -1
            return <line className={activeNoteId === item.note.id ? 'active' : ''} key={`secondary-${item.note.id}`} x1={item.stemX} y1={item.stemEndY + secondaryOffset} x2={item.stemX + hookDirection * 12} y2={item.stemEndY + secondaryOffset} />
          })}
        </g>)}
        {ties.map(({ from, to }) => <path key={`tie-${from.note.id}`} className="note-tie" d={`M ${from.x + 7} ${from.y + 9} Q ${(from.x + to.x) / 2} ${Math.max(from.y, to.y) + 20} ${to.x - 7} ${to.y + 9}`} />)}
        {tuplets.map((item) => <text key={`tuplet-${item.note.id}`} className="tuplet-number" x={item.x} y={Math.max(14, Math.min(32, item.stemEndY - 6))} textAnchor="middle">{item.note.tuplet!.actual}</text>)}
        <line className="playhead" x1={playheadX} x2={playheadX} y1="25" y2="160" />
        </svg>
      </div>
    </div>
  </section>
}
