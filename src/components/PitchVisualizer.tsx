import { useEffect, useRef, useState } from 'react'
import type { EvaluatedFrame } from '../types/audio'
import type { NoteNaming, ReferenceTrack } from '../types/music'
import { midiToDisplayName } from '../music/noteUtils'
import { trackDuration } from '../music/referenceTrack'

interface Props { track: ReferenceTrack; frames: EvaluatedFrame[]; elapsed: number; running: boolean; naming: NoteNaming; selectedNoteId?: string; onSelectNote: (id: string) => void }

const ZOOM_LEVELS = [80, 140, 220]

export function PitchVisualizer({ track, frames, elapsed, running, naming, selectedNoteId, onSelectNote }: Props) {
  const [zoomIndex, setZoomIndex] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pixelsPerSecond = ZOOM_LEVELS[zoomIndex]
  const height = 360, left = 48, top = 20, right = 24, bottom = 34
  const duration = Math.max(trackDuration(track), 1)
  const width = Math.max(720, Math.ceil(left + duration * pixelsPerSecond + right))
  const allMidi = [...track.notes.map((note) => note.midi), ...frames.map((frame) => frame.midi)]
  const minMidi = Math.floor(Math.min(...allMidi, 60) - 2), maxMidi = Math.ceil(Math.max(...allMidi, 67) + 2)
  const x = (time: number) => left + time * pixelsPerSecond
  const y = (midi: number) => top + ((maxMidi - midi) / (maxMidi - minMidi)) * (height - top - bottom)
  const points = frames.map((frame) => `${x(frame.timestamp)},${y(frame.midi)}`).join(' ')
  const secondStep = pixelsPerSecond < 100 ? 2 : 1
  const timeTicks = Array.from({ length: Math.floor(duration / secondStep) + 1 }, (_, index) => index * secondStep)

  useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport) return
    if (elapsed === 0) { viewport.scrollLeft = 0; return }
    if (!running) return
    const desired = left + elapsed * pixelsPerSecond - viewport.clientWidth * 0.35
    viewport.scrollLeft = Math.max(0, Math.min(desired, viewport.scrollWidth - viewport.clientWidth))
  }, [elapsed, pixelsPerSecond, running])

  return <section className="visualizer-panel">
    <div className="visualizer-toolbar">
      <span>Timeline · {pixelsPerSecond} px/s</span>
      <div><button type="button" aria-label="Diminuir timeline" disabled={zoomIndex === 0} onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}>−</button><button type="button" aria-label="Aumentar timeline" disabled={zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))}>+</button></div>
    </div>
    <div className="visualizer-wrap" ref={scrollRef}>
      <svg className="visualizer" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Timeline de pitch">
        {Array.from({ length: maxMidi - minMidi + 1 }, (_, index) => maxMidi - index).map((midi) => <g key={midi}>
          <line x1={left} x2={width - right} y1={y(midi)} y2={y(midi)} className="grid" />
          <text x={left - 8} y={y(midi) + 4} textAnchor="end">{midiToDisplayName(midi, naming)}</text>
        </g>)}
        {timeTicks.map((time) => <g key={time}>
          <line x1={x(time)} x2={x(time)} y1={top} y2={height - bottom} className="time-grid" />
          <text x={x(time) + 3} y={height - 10}>{time}s</text>
        </g>)}
        {track.notes.map((note) => <g key={note.id} className={`timeline-note ${selectedNoteId === note.id ? 'selected' : ''}`} role="button" tabIndex={0} onClick={() => onSelectNote(note.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectNote(note.id) }}>
          <rect className="expected-note" x={x(note.start)} y={y(note.midi) - 8} width={Math.max(4, note.duration * pixelsPerSecond)} height="16" rx="3" />
          <text className="note-label" x={x(note.start) + 5} y={y(note.midi) - 12}>{midiToDisplayName(note.midi, naming)}</text>
        </g>)}
        {points && <polyline className="sung-line" points={points} />}
        <line className="playhead" x1={x(Math.min(elapsed, duration))} x2={x(Math.min(elapsed, duration))} y1={top} y2={height - bottom} />
        <line className="axis" x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} />
      </svg>
    </div>
  </section>
}
