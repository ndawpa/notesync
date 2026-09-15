import { unzipSync } from 'fflate'
import type { KeySignatureChange, ReferenceNote, ReferenceTrack, TimeSignatureChange } from '../types/music'
import { midiToNoteName } from './noteUtils'

const STEP_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
export const musicXmlPitchToMidi = (step: string, alter: number, octave: number) => (octave + 1) * 12 + (STEP_OFFSETS[step] ?? 0) + alter

interface BeatNote { midi: number; startBeat: number; durationBeats: number; lyric?: string; tieStart?: boolean; tieStop?: boolean; tuplet?: { actual: number; normal: number } }
interface BeatTempo { beat: number; bpm: number }

function childText(element: Element, selector: string, fallback = '') { return element.querySelector(selector)?.textContent?.trim() || fallback }
function beatToSeconds(target: number, tempos: BeatTempo[]) {
  let seconds = 0, previousBeat = 0, bpm = tempos[0]?.bpm ?? 120
  for (const tempo of tempos) { if (tempo.beat > target) break; seconds += (tempo.beat - previousBeat) * 60 / bpm; previousBeat = tempo.beat; bpm = tempo.bpm }
  return seconds + (target - previousBeat) * 60 / bpm
}

export function parseMusicXml(xml: string, fileName = 'Partitura MusicXML'): ReferenceTrack[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror') || !document.documentElement.matches('score-partwise, score-timewise')) throw new Error('O arquivo não contém uma partitura MusicXML válida.')
  if (document.documentElement.matches('score-timewise')) throw new Error('MusicXML timewise ainda não é suportado; exporte como partwise.')
  const partNames = new Map([...document.querySelectorAll('score-part')].map((part) => [part.id, childText(part, 'part-name', part.id)]))
  const title = childText(document.documentElement, 'work > work-title', fileName.replace(/\.(musicxml|xml|mxl)$/i, ''))
  const tempos: BeatTempo[] = [{ beat: 0, bpm: 120 }]
  const timeSignatures: Array<TimeSignatureChange & { beat: number }> = []
  const keySignatures: Array<KeySignatureChange & { beat: number }> = []
  const output: Array<{ name: string; notes: BeatNote[] }> = []
  for (const part of document.documentElement.querySelectorAll(':scope > part')) {
    let divisions = 1, cursorBeat = 0, measureStart = 0, lastStart = 0
    const voices = new Map<string, BeatNote[]>()
    for (const measure of part.querySelectorAll(':scope > measure')) {
      let measureEnd = measureStart
      for (const child of measure.children) {
        if (child.tagName === 'attributes') {
          divisions = Number(childText(child, 'divisions', String(divisions))) || divisions
          const beats = Number(childText(child, 'time > beats', '0')), beatType = Number(childText(child, 'time > beat-type', '0'))
          if (beats && beatType) timeSignatures.push({ beat: cursorBeat, time: 0, numerator: beats, denominator: beatType })
          const fifths = Number(childText(child, 'key > fifths', 'NaN'))
          if (Number.isFinite(fifths)) keySignatures.push({ beat: cursorBeat, time: 0, fifths, mode: childText(child, 'key > mode', 'major') === 'minor' ? 'minor' : 'major' })
        } else if (child.tagName === 'direction') {
          const bpm = Number(child.querySelector('sound')?.getAttribute('tempo') || childText(child, 'per-minute', 'NaN'))
          if (Number.isFinite(bpm) && bpm > 0) tempos.push({ beat: cursorBeat, bpm })
        } else if (child.tagName === 'backup') cursorBeat -= Number(childText(child, 'duration', '0')) / divisions
        else if (child.tagName === 'forward') cursorBeat += Number(childText(child, 'duration', '0')) / divisions
        else if (child.tagName === 'note') {
          const durationBeats = Number(childText(child, 'duration', '0')) / divisions
          const startBeat = child.querySelector('chord') ? lastStart : cursorBeat
          lastStart = startBeat
          if (!child.querySelector('rest, grace')) {
            const step = childText(child, 'pitch > step'), alter = Number(childText(child, 'pitch > alter', '0')), octave = Number(childText(child, 'pitch > octave', '4'))
            const voice = childText(child, 'voice', '1'), notes = voices.get(voice) ?? []
            const actual = Number(childText(child, 'time-modification > actual-notes', '0')), normal = Number(childText(child, 'time-modification > normal-notes', '0'))
            notes.push({ midi: musicXmlPitchToMidi(step, alter, octave), startBeat, durationBeats: Math.max(durationBeats, 0.0625), lyric: childText(child, 'lyric > text') || undefined, tieStart: Boolean(child.querySelector('tie[type="start"], tied[type="start"]')), tieStop: Boolean(child.querySelector('tie[type="stop"], tied[type="stop"]')), tuplet: actual > 0 && normal > 0 ? { actual, normal } : undefined }); voices.set(voice, notes)
          }
          if (!child.querySelector('chord')) cursorBeat += durationBeats
          measureEnd = Math.max(measureEnd, cursorBeat)
        }
      }
      const activeSignature = timeSignatures.at(-1)
      const nominalBeats = activeSignature ? activeSignature.numerator * 4 / activeSignature.denominator : 4
      measureStart = Math.max(measureEnd, measureStart + nominalBeats); cursorBeat = measureStart
    }
    const partName = partNames.get(part.id) || part.id
    for (const [voice, notes] of voices) output.push({ name: voices.size > 1 ? `${partName} · voz ${voice}` : partName, notes })
  }
  if (!output.length) throw new Error('Nenhuma nota foi encontrada no MusicXML.')
  const orderedTempos = tempos.sort((a, b) => a.beat - b.beat).filter((item, index, list) => index === list.length - 1 || item.beat !== list[index + 1].beat)
  const convertEvents = <T extends { beat: number }>(events: T[]) => events.sort((a, b) => a.beat - b.beat).filter((item, index, list) => index === list.length - 1 || item.beat !== list[index + 1].beat).map(({ beat, ...event }) => ({ ...event, time: beatToSeconds(beat, orderedTempos) }))
  return output.map((voice) => ({ name: `${title} — ${voice.name}`, bpm: orderedTempos[0].bpm, tempoChanges: orderedTempos.map((tempo) => ({ time: beatToSeconds(tempo.beat, orderedTempos), bpm: tempo.bpm })), timeSignatures: convertEvents(timeSignatures), keySignatures: convertEvents(keySignatures), notes: voice.notes.map((note, index): ReferenceNote => ({ id: String(index + 1), midi: note.midi, pitch: midiToNoteName(note.midi), start: beatToSeconds(note.startBeat, orderedTempos), duration: beatToSeconds(note.startBeat + note.durationBeats, orderedTempos) - beatToSeconds(note.startBeat, orderedTempos), lyric: note.lyric, tieStart: note.tieStart, tieStop: note.tieStop, tuplet: note.tuplet })) }))
}

export function parseMusicXmlFile(buffer: ArrayBuffer, fileName: string): ReferenceTrack[] {
  if (!/\.mxl$/i.test(fileName)) return parseMusicXml(new TextDecoder().decode(buffer), fileName)
  const files = unzipSync(new Uint8Array(buffer))
  const container = files['META-INF/container.xml'] && new TextDecoder().decode(files['META-INF/container.xml'])
  const rootPath = container?.match(/full-path=["']([^"']+)/)?.[1]
  const entry = rootPath ? files[rootPath] : Object.entries(files).find(([name]) => /\.(musicxml|xml)$/i.test(name) && !name.startsWith('META-INF/'))?.[1]
  if (!entry) throw new Error('O arquivo MXL não contém uma partitura MusicXML.')
  return parseMusicXml(new TextDecoder().decode(entry), fileName)
}
