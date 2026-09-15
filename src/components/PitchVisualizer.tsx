import { useEffect, useRef, useState } from 'react'
import type { EvaluatedFrame } from '../types/audio'
import type { NoteNaming, ReferenceTrack } from '../types/music'
import { midiToDisplayName } from '../music/noteUtils'
import { noteAtTime, trackDuration } from '../music/referenceTrack'

interface Props { track: ReferenceTrack; frames: EvaluatedFrame[]; elapsed: number; running: boolean; naming: NoteNaming; selectedNoteId?: string; onSelectNote: (id: string) => void }

const ZOOM_LEVELS = [80, 140, 220]
const HEIGHT = 360
const TOP = 20
const BOTTOM = 34
const PITCH_GUIDE_WIDTH = 102
const BLACK_PITCHES = new Set([1, 3, 6, 8, 10])

export function PitchVisualizer({ track, frames, elapsed, running, naming, selectedNoteId, onSelectNote }: Props) {
  const [zoomIndex, setZoomIndex] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pixelsPerSecond = ZOOM_LEVELS[zoomIndex]
  const duration = Math.max(trackDuration(track), 1)
  const width = Math.max(620, Math.ceil(duration * pixelsPerSecond + 24))
  const referenceMidi = track.notes.map((note) => note.midi)
  const minMidi = Math.floor(Math.min(...referenceMidi, 60) - 2)
  const maxMidi = Math.ceil(Math.max(...referenceMidi, 67) + 2)
  const x = (time: number) => time * pixelsPerSecond
  const y = (midi: number) => TOP + ((maxMidi - midi) / (maxMidi - minMidi)) * (HEIGHT - TOP - BOTTOM)
  const rowHeight = (HEIGHT - TOP - BOTTOM) / (maxMidi - minMidi)
  const points = frames.map((frame) => x(frame.timestamp) + ',' + y(frame.midi)).join(' ')
  const secondStep = pixelsPerSecond < 100 ? 2 : 1
  const timeTicks = Array.from({ length: Math.floor(duration / secondStep) + 1 }, (_, index) => index * secondStep)
  const pitchRows = Array.from({ length: maxMidi - minMidi + 1 }, (_, index) => maxMidi - index)
  const activeNote = noteAtTime(track, elapsed)
  const activeMidi = activeNote?.midi

  useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport) return
    if (elapsed === 0) { viewport.scrollLeft = 0; return }
    if (!running) return
    const desired = Math.round(elapsed * pixelsPerSecond - viewport.clientWidth * 0.35)
    viewport.scrollLeft = Math.max(0, Math.min(desired, viewport.scrollWidth - viewport.clientWidth))
  }, [elapsed, pixelsPerSecond, running])

  return <section className="visualizer-panel">
    <div className="visualizer-toolbar">
      <span>Timeline · {pixelsPerSecond} px/s</span>
      <div><button type="button" aria-label="Diminuir timeline" disabled={zoomIndex === 0} onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}>−</button><button type="button" aria-label="Aumentar timeline" disabled={zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))}>+</button></div>
    </div>
    <div className="visualizer-body">
      <svg className="pitch-guide" width={PITCH_GUIDE_WIDTH} height={HEIGHT} viewBox={'0 0 ' + PITCH_GUIDE_WIDTH + ' ' + HEIGHT} aria-label="Escala MIDI e piano">
        <rect className="pitch-guide-background" width={PITCH_GUIDE_WIDTH} height={HEIGHT} />
        {pitchRows.map((midi) => {
          const black = BLACK_PITCHES.has(((midi % 12) + 12) % 12)
          const active = midi === activeMidi
          return <g key={midi}>
            <text className="midi-number" x="29" y={y(midi) + 4} textAnchor="end">{midi}</text>
            <rect className={'piano-key ' + (black ? 'black' : 'white') + (active ? ' active' : '')} x={black ? 57 : 39} y={y(midi) - rowHeight / 2} width={black ? 43 : 61} height={Math.max(5, rowHeight)} rx="1" />
          </g>
        })}
      </svg>
      <div className="visualizer-wrap" ref={scrollRef}>
        <svg className="visualizer" width={width} height={HEIGHT} viewBox={'0 0 ' + width + ' ' + HEIGHT} role="img" aria-label="Timeline de pitch">
          {pitchRows.map((midi) => <line key={midi} x1="0" x2={width} y1={y(midi)} y2={y(midi)} className="grid" />)}
          {timeTicks.map((time) => <g key={time}><line x1={x(time)} x2={x(time)} y1={TOP} y2={HEIGHT - BOTTOM} className="time-grid" /><text x={x(time) + 3} y={HEIGHT - 10}>{time}s</text></g>)}
          {track.notes.map((note) => <g key={note.id} className={`timeline-note ${selectedNoteId === note.id ? 'selected' : ''} ${running && activeNote?.id === note.id ? 'active' : ''}`} role="button" tabIndex={0} onClick={() => onSelectNote(note.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectNote(note.id) }}>
            <rect className="expected-note" x={x(note.start)} y={y(note.midi) - 8} width={Math.max(4, note.duration * pixelsPerSecond)} height="16" rx="3" />
            <text className="note-label" x={x(note.start) + 5} y={y(note.midi) - 12}>{naming === 'lyrics' ? note.lyric : midiToDisplayName(note.midi, naming)}</text>
          </g>)}
          {points && <polyline className="sung-line" points={points} />}
          <line className="playhead" x1={x(Math.min(elapsed, duration))} x2={x(Math.min(elapsed, duration))} y1={TOP} y2={HEIGHT - BOTTOM} />
          <line className="axis" x1="0" x2={width} y1={HEIGHT - BOTTOM} y2={HEIGHT - BOTTOM} />
        </svg>
      </div>
    </div>
  </section>
}
