export interface RhythmFigure { beats: number; name: string; restSymbol: string; filled: boolean; stem: boolean; flags: number }
export type Clef = 'treble' | 'treble8vb' | 'bass'
export type ClefPreference = 'auto' | Clef

export const RHYTHM_FIGURES: RhythmFigure[] = [
  { beats: 4, name: 'semibreve', restSymbol: '𝄻', filled: false, stem: false, flags: 0 },
  { beats: 3, name: 'mínima pontuada', restSymbol: '𝄼·', filled: false, stem: true, flags: 0 },
  { beats: 2, name: 'mínima', restSymbol: '𝄼', filled: false, stem: true, flags: 0 },
  { beats: 1.5, name: 'semínima pontuada', restSymbol: '𝄽·', filled: true, stem: true, flags: 0 },
  { beats: 1, name: 'semínima', restSymbol: '𝄽', filled: true, stem: true, flags: 0 },
  { beats: 0.5, name: 'colcheia', restSymbol: '𝄾', filled: true, stem: true, flags: 1 },
  { beats: 0.25, name: 'semicolcheia', restSymbol: '𝄿', filled: true, stem: true, flags: 2 },
]

export const secondsToBeats = (seconds: number, bpm: number) => seconds * bpm / 60

export function closestRhythmFigure(beats: number): RhythmFigure {
  return RHYTHM_FIGURES.reduce((closest, figure) => Math.abs(figure.beats - beats) < Math.abs(closest.beats - beats) ? figure : closest)
}

export function splitIntoRhythmFigures(beats: number): RhythmFigure[] {
  const figures: RhythmFigure[] = []
  let remaining = Math.max(0, beats)
  while (remaining >= 0.125 && figures.length < 64) {
    const figure = RHYTHM_FIGURES.find((candidate) => candidate.beats <= remaining + 0.01) ?? RHYTHM_FIGURES.at(-1)!
    figures.push(figure)
    remaining -= figure.beats
  }
  return figures
}

const DIATONIC_STEPS = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
export const midiToStaffStep = (midi: number) => (Math.floor(midi / 12) - 1) * 7 + DIATONIC_STEPS[((midi % 12) + 12) % 12]
export const isSharpMidi = (midi: number) => [1, 3, 6, 8, 10].includes(((Math.round(midi) % 12) + 12) % 12)

const CLEFS: Record<Clef, { bottomMidi: number; writtenOffset: number; label: string }> = {
  treble: { bottomMidi: 64, writtenOffset: 0, label: 'Clave de Sol' },
  treble8vb: { bottomMidi: 64, writtenOffset: 12, label: 'Clave de Sol 8vb' },
  bass: { bottomMidi: 43, writtenOffset: 0, label: 'Clave de Fá' },
}

export const clefLabel = (clef: Clef) => CLEFS[clef].label
export const writtenMidiForClef = (midi: number, clef: Clef) => midi + CLEFS[clef].writtenOffset
export const staffBottomStep = (clef: Clef) => midiToStaffStep(CLEFS[clef].bottomMidi)

export function chooseAutomaticClef(midis: number[]): Clef {
  if (!midis.length) return 'treble'
  const candidates: Clef[] = ['treble', 'treble8vb', 'bass']
  return candidates.reduce((best, clef) => {
    const bottom = staffBottomStep(clef), top = bottom + 8, center = bottom + 4
    const cost = midis.reduce((sum, midi) => {
      const step = midiToStaffStep(writtenMidiForClef(midi, clef))
      const outside = step < bottom ? bottom - step : step > top ? step - top : 0
      return sum + outside * outside * 10 + Math.abs(step - center) * 0.05
    }, 0)
    return cost < best.cost ? { clef, cost } : best
  }, { clef: 'treble' as Clef, cost: Number.POSITIVE_INFINITY }).clef
}

export const resolveClef = (preference: ClefPreference, midis: number[]): Clef => preference === 'auto' ? chooseAutomaticClef(midis) : preference

export function ledgerLinePositions(noteY: number, staffTop: number, staffBottom: number, lineSpacing: number): number[] {
  const positions: number[] = []
  if (noteY > staffBottom) {
    for (let y = staffBottom + lineSpacing; y <= noteY + 0.01; y += lineSpacing) positions.push(y)
  } else if (noteY < staffTop) {
    for (let y = staffTop - lineSpacing; y >= noteY - 0.01; y -= lineSpacing) positions.push(y)
  }
  return positions
}
