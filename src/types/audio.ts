export interface PitchFrame {
  frequency: number
  midi: number
  note: string
  cents: number
  confidence: number
  timestamp: number
  volume: number
}

export interface PitchDetection {
  frequency: number
  confidence: number
  volume: number
}

export interface EvaluatedFrame extends PitchFrame {
  expectedNoteId: string
  expectedMidi: number
  differenceCents: number
}
