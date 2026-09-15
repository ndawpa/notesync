export interface ReferenceNote {
  id: string
  pitch: string
  midi: number
  start: number
  duration: number
}

export interface ReferenceTrack {
  name: string
  bpm?: number
  tempoChanges?: Array<{ time: number; bpm: number }>
  notes: ReferenceNote[]
}
