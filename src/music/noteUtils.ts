const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NOTE_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

export const frequencyToMidiFloat = (frequency: number) => 69 + 12 * Math.log2(frequency / 440)
export const frequencyToMidi = (frequency: number) => Math.round(frequencyToMidiFloat(frequency))
export const midiToFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
export const midiToNoteName = (midi: number) => `${NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`
const SOLFEGE_NAMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si']
const FLAT_SOLFEGE_NAMES = ['Dó', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Sol♭', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si']
export const midiToSolfegeName = (midi: number) => `${SOLFEGE_NAMES[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`
export function midiToDisplayName(midi: number, naming: 'letter' | 'solfege' | 'lyrics' | 'hidden', includeOctave = true, preferFlats = false) {
  if (naming === 'hidden' || naming === 'lyrics') return ''
  const rounded = Math.round(midi), pitchClass = ((rounded % 12) + 12) % 12, octave = Math.floor(rounded / 12) - 1
  const complete = preferFlats ? `${naming === 'solfege' ? FLAT_SOLFEGE_NAMES[pitchClass] : FLAT_NOTE_NAMES[pitchClass]}${octave}` : naming === 'solfege' ? midiToSolfegeName(midi) : midiToNoteName(midi)
  return includeOctave ? complete : complete.replace(/-?\d+$/, '')
}
export const frequencyDifferenceInCents = (actual: number, expected: number) => 1200 * Math.log2(actual / expected)
