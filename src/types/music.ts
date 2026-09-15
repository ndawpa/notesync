export interface ReferenceNote {
  id: string
  pitch: string
  midi: number
  start: number
  duration: number
  lyric?: string
}

export interface ReferenceTrack {
  name: string
  bpm?: number
  tempoChanges?: Array<{ time: number; bpm: number }>
  notes: ReferenceNote[]
}

export type MusicView = 'timeline' | 'score'
export type NoteNaming = 'letter' | 'solfege' | 'lyrics' | 'hidden'
