import type { EvaluatedFrame } from '../types/audio'
import type { ReferenceTrack } from '../types/music'
import { trackDuration } from '../music/referenceTrack'

interface Props { track: ReferenceTrack; frames: EvaluatedFrame[]; elapsed: number }

export function PitchVisualizer({ track, frames, elapsed }: Props) {
  const width = 900, height = 360, left = 48, top = 20, right = 18, bottom = 34
  const duration = Math.max(trackDuration(track), 1)
  const allMidi = [...track.notes.map((note) => note.midi), ...frames.map((frame) => frame.midi)]
  const minMidi = Math.floor(Math.min(...allMidi, 60) - 2), maxMidi = Math.ceil(Math.max(...allMidi, 67) + 2)
  const x = (time: number) => left + (time / duration) * (width - left - right)
  const y = (midi: number) => top + ((maxMidi - midi) / (maxMidi - minMidi)) * (height - top - bottom)
  const points = frames.map((frame) => `${x(frame.timestamp)},${y(frame.midi)}`).join(' ')
  return <section className="visualizer-wrap">
    <svg className="visualizer" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Timeline de pitch">
      {Array.from({ length: maxMidi - minMidi + 1 }, (_, index) => maxMidi - index).map((midi) => <g key={midi}>
        <line x1={left} x2={width - right} y1={y(midi)} y2={y(midi)} className="grid" />
        <text x={left - 8} y={y(midi) + 4} textAnchor="end">{midi}</text>
      </g>)}
      {track.notes.map((note) => <g key={note.id}>
        <rect className="expected-note" x={x(note.start)} y={y(note.midi) - 7} width={Math.max(3, x(note.start + note.duration) - x(note.start))} height="14" rx="3" />
        <text className="note-label" x={x(note.start) + 4} y={y(note.midi) - 11}>{note.pitch}</text>
      </g>)}
      {points && <polyline className="sung-line" points={points} />}
      <line className="playhead" x1={x(Math.min(elapsed, duration))} x2={x(Math.min(elapsed, duration))} y1={top} y2={height - bottom} />
      <line className="axis" x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} />
      <text x={width - right} y={height - 8} textAnchor="end">tempo ({duration.toFixed(1)}s)</text>
    </svg>
  </section>
}
