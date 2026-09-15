import { describe, expect, it } from 'vitest'
import { DOMParser } from 'linkedom'
import { zipSync, strToU8 } from 'fflate'
import { musicXmlPitchToMidi, parseMusicXml, parseMusicXmlFile } from './musicXmlParser'

globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser

const xml = `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>Teste</work-title></work><part-list><score-part id="P1"><part-name>Soprano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>2</divisions><key><fifths>1</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time></attributes><direction><sound tempo="90"/></direction><note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><voice>1</voice><tie type="start"/><lyric><text>Fá</text></lyric></note><note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration><voice>1</voice><tie type="stop"/><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification></note></measure></part></score-partwise>`

describe('MusicXML parser helpers', () => {
  it('converts written pitch to MIDI', () => { expect(musicXmlPitchToMidi('C', 0, 4)).toBe(60); expect(musicXmlPitchToMidi('F', 1, 4)).toBe(66); expect(musicXmlPitchToMidi('B', -1, 3)).toBe(58) })
  it('imports tempo, meter, key, lyrics, ties and tuplets', () => {
    const [track] = parseMusicXml(xml, 'teste.musicxml')
    expect(track).toMatchObject({ name: 'Teste — Soprano', bpm: 90, timeSignatures: [{ time: 0, numerator: 3, denominator: 4 }], keySignatures: [{ time: 0, fifths: 1, mode: 'major' }] })
    expect(track.notes[0]).toMatchObject({ midi: 66, start: 0, duration: 2 / 3, lyric: 'Fá', tieStart: true })
    expect(track.notes[1]).toMatchObject({ tieStop: true, tuplet: { actual: 3, normal: 2 } })
  })
  it('opens a compressed MXL container', () => {
    const compressed = zipSync({ 'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="score.musicxml"/></rootfiles></container>'), 'score.musicxml': strToU8(xml) })
    expect(parseMusicXmlFile(compressed.buffer as ArrayBuffer, 'teste.mxl')[0].notes).toHaveLength(2)
  })
})
