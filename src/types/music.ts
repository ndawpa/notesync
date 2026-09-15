export interface ReferenceNote {
  id: string
  pitch: string
  midi: number
  start: number
  duration: number
  lyric?: string
  tieStart?: boolean
  tieStop?: boolean
  tuplet?: { actual: number; normal: number }
}

export interface ReferenceTrack {
  name: string
  bpm?: number
  tempoChanges?: Array<{ time: number; bpm: number }>
  timeSignatures?: TimeSignatureChange[]
  keySignatures?: KeySignatureChange[]
  notes: ReferenceNote[]
}

export interface TimeSignatureChange {
  time: number
  numerator: number
  denominator: number
  clocksPerClick?: number
}

export interface KeySignatureChange {
  time: number
  fifths: number
  mode: 'major' | 'minor'
}

export type MusicView = 'timeline' | 'score'
export type ScoreLayout = 'continuous' | 'systems'
export type NoteNaming = 'letter' | 'solfege' | 'lyrics' | 'hidden'
