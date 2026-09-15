import { useEffect, useRef, useState } from 'react'
import { MicrophoneInput } from './audio/microphone'
import { ReferencePlayer } from './audio/referencePlayer'
import { detectPitchYin, medianFrequency, rootMeanSquare } from './audio/pitchDetector'
import { Controls } from './components/Controls'
import { CurrentNote } from './components/CurrentNote'
import { PitchVisualizer } from './components/PitchVisualizer'
import { SheetMusic } from './components/SheetMusic'
import { MusicViewControls } from './components/MusicViewControls'
import { NoteEditor } from './components/NoteEditor'
import { ScorePanel } from './components/ScorePanel'
import { frequencyDifferenceInCents, frequencyToMidi, frequencyToMidiFloat, midiToFrequency, midiToNoteName } from './music/noteUtils'
import { changeTrackBpm, DEFAULT_TRACK, noteAtTime, parseReferenceTrack, trackDuration } from './music/referenceTrack'
import { parseMidiFile } from './music/midiParser'
import { calculateSessionScore, type SessionScore } from './scoring/overallScore'
import type { EvaluatedFrame, PitchFrame } from './types/audio'
import type { MusicView, NoteNaming, ReferenceNote, ReferenceTrack } from './types/music'
import type { ClefPreference, KeySignaturePreference } from './music/notationUtils'

export default function App() {
  const [track, setTrack] = useState<ReferenceTrack>(DEFAULT_TRACK)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [volume, setVolume] = useState(0)
  const [detected, setDetected] = useState<PitchFrame>()
  const [frames, setFrames] = useState<EvaluatedFrame[]>([])
  const [score, setScore] = useState<SessionScore>()
  const [error, setError] = useState('')
  const [playReference, setPlayReference] = useState(true)
  const [referenceVolume, setReferenceVolume] = useState(0.35)
  const [metronome, setMetronome] = useState(true)
  const [initialCue, setInitialCue] = useState(true)
  const [initialCueBeats, setInitialCueBeats] = useState(2)
  const [countInBeats, setCountInBeats] = useState(4)
  const [musicView, setMusicView] = useState<MusicView>('timeline')
  const [noteNaming, setNoteNaming] = useState<NoteNaming>('letter')
  const [clefPreference, setClefPreference] = useState<ClefPreference>('auto')
  const [keySignaturePreference, setKeySignaturePreference] = useState<KeySignaturePreference>('auto')
  const [selectedNoteId, setSelectedNoteId] = useState<string>()
  const [countdown, setCountdown] = useState<number>()
  const inputRef = useRef<HTMLInputElement>(null)
  const microphoneRef = useRef<MicrophoneInput | undefined>(undefined)
  const referencePlayerRef = useRef<ReferencePlayer | undefined>(undefined)
  const animationRef = useRef<number | undefined>(undefined)
  const framesRef = useRef<EvaluatedFrame[]>([])
  const trackRef = useRef(track)
  const historyRef = useRef<Array<{ frequency: number; timestamp: number }>>([])
  const lastAnalysisRef = useRef(0)
  const lastRenderRef = useRef(0)

  useEffect(() => { trackRef.current = track }, [track])
  useEffect(() => () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); referencePlayerRef.current?.stop(); void microphoneRef.current?.close() }, [])

  const finish = async () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    animationRef.current = undefined
    const completedFrames = framesRef.current
    referencePlayerRef.current?.stop()
    referencePlayerRef.current = undefined
    setRunning(false)
    setCountdown(undefined)
    setScore(calculateSessionScore(trackRef.current, completedFrames))
    const microphone = microphoneRef.current
    microphoneRef.current = undefined
    await microphone?.close()
  }

  const start = async () => {
    setError(''); setScore(undefined); setFrames([]); setElapsed(0); setDetected(undefined)
    framesRef.current = []; historyRef.current = []; lastAnalysisRef.current = 0; lastRenderRef.current = 0
    try {
      const microphone = await MicrophoneInput.create()
      microphoneRef.current = microphone
      const initialBpm = trackRef.current.tempoChanges?.[0]?.bpm ?? trackRef.current.bpm ?? 60
      const initialSignature = trackRef.current.timeSignatures?.[0]
      const pulseBeats = initialSignature?.clocksPerClick ? initialSignature.clocksPerClick / 24 : (initialSignature && initialSignature.numerator > 3 && initialSignature.numerator % 3 === 0 ? 1.5 : 4 / (initialSignature?.denominator ?? 4))
      const beatDuration = 60 / initialBpm * pulseBeats
      const countStartedAt = microphone.context.currentTime + 0.15
      const preparationBeats = Math.max(countInBeats, initialCue ? initialCueBeats : 0)
      const preparationDuration = preparationBeats * beatDuration
      const startedAt = countStartedAt + preparationDuration
      if (playReference || metronome || initialCue) {
        const player = new ReferencePlayer(microphone.context, referenceVolume)
        if (playReference) player.schedule(trackRef.current, startedAt)
        if (metronome) player.scheduleMetronome(trackRef.current, startedAt, startedAt - countInBeats * beatDuration, countInBeats)
        if (initialCue && trackRef.current.notes[0]) player.scheduleCue(trackRef.current.notes[0].midi, countStartedAt + 0.05, Math.max(0.2, initialCueBeats * beatDuration - 0.1))
        referencePlayerRef.current = player
      }
      setRunning(true)
      const analyse = () => {
        const mic = microphoneRef.current
        if (!mic) return
        const now = mic.context.currentTime - startedAt
        if (now < 0) {
          setCountdown(countInBeats && -now <= countInBeats * beatDuration ? Math.min(countInBeats, Math.ceil(-now / beatDuration)) : undefined)
          animationRef.current = requestAnimationFrame(analyse); return
        }
        setCountdown(undefined)
        if (now >= trackDuration(trackRef.current)) { setElapsed(trackDuration(trackRef.current)); void finish(); return }
        setElapsed(now)
        if (now - lastAnalysisRef.current < 1 / 30) { animationRef.current = requestAnimationFrame(analyse); return }
        lastAnalysisRef.current = now
        const samples = mic.readSamples()
        setVolume(rootMeanSquare(samples))
        const result = detectPitchYin(samples, mic.context.sampleRate)
        const expected = noteAtTime(trackRef.current, now)
        if (result) {
          historyRef.current.push({ frequency: result.frequency, timestamp: now })
          historyRef.current = historyRef.current.filter((item) => now - item.timestamp <= 0.15)
          const frequency = medianFrequency(historyRef.current, now)
          const nearestMidi = frequencyToMidi(frequency)
          const pitchFrame: PitchFrame = { frequency, midi: frequencyToMidiFloat(frequency), note: midiToNoteName(nearestMidi), cents: frequencyDifferenceInCents(frequency, midiToFrequency(nearestMidi)), confidence: result.confidence, timestamp: now, volume: result.volume }
          setDetected(pitchFrame)
          if (expected) framesRef.current.push({ ...pitchFrame, expectedNoteId: expected.id, expectedMidi: expected.midi, differenceCents: frequencyDifferenceInCents(frequency, midiToFrequency(expected.midi)) })
        } else setDetected(undefined)
        if (now - lastRenderRef.current > 0.05) { setFrames([...framesRef.current]); lastRenderRef.current = now }
        animationRef.current = requestAnimationFrame(analyse)
      }
      animationRef.current = requestAnimationFrame(analyse)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível acessar o microfone.'); setRunning(false) }
  }

  const reset = () => { setElapsed(0); setFrames([]); setScore(undefined); setDetected(undefined); setVolume(0); setCountdown(undefined); framesRef.current = [] }
  const expected = noteAtTime(track, elapsed)
  const currentEvaluated = frames.at(-1)
  const difference = currentEvaluated && currentEvaluated.expectedNoteId === expected?.id ? currentEvaluated.differenceCents : undefined

  const loadFile = async (file?: File) => {
    if (!file) return
    try {
      const isMidi = /\.(mid|midi)$/i.test(file.name)
      const next = isMidi ? parseMidiFile(await file.arrayBuffer(), file.name) : parseReferenceTrack(JSON.parse(await file.text()))
      if (noteNaming === 'lyrics' && !next.notes.some((note) => note.lyric?.trim())) setNoteNaming('letter')
      setTrack(next); setSelectedNoteId(undefined); reset(); setError('')
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível ler o exercício.') }
    finally { if (inputRef.current) inputRef.current.value = '' }
  }

  const saveNote = (updated: ReferenceNote) => {
    setTrack((current) => ({ ...current, notes: current.notes.map((note) => note.id === updated.id ? updated : note).sort((a, b) => a.start - b.start) }))
    reset()
  }
  const deleteNote = () => {
    if (!selectedNoteId || track.notes.length <= 1) return
    setTrack((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== selectedNoteId) }))
    setSelectedNoteId(undefined); reset()
  }
  const addNote = () => {
    const last = track.notes.at(-1)
    const duration = 60 / (track.bpm ?? 60)
    const id = `edited-${Date.now()}`
    setTrack((current) => ({ ...current, notes: [...current.notes, { id, midi: last?.midi ?? 60, pitch: last?.pitch ?? 'C4', start: trackDuration(current), duration }] }))
    setSelectedNoteId(id); reset()
  }
  const selectNote = (id: string) => { if (!running) setSelectedNoteId(id) }
  const changeBpm = (bpm: number) => { setTrack((current) => changeTrackBpm(current, bpm)); reset() }
  const selectedNote = track.notes.find((note) => note.id === selectedNoteId)

  return <main>
    <header><div><p className="eyebrow">Treinamento vocal</p><h1>{track.name}</h1><p>{track.bpm ? `${track.bpm} BPM · ` : ''}{track.notes.length} notas · {trackDuration(track).toFixed(1)} segundos</p></div><Controls running={running} hasResults={Boolean(score)} playReference={playReference} referenceVolume={referenceVolume} metronome={metronome} initialCue={initialCue} initialCueBeats={initialCueBeats} countInBeats={countInBeats} onLoad={() => inputRef.current?.click()} onStart={() => void start()} onStop={() => void finish()} onReset={reset} onPlayReferenceChange={setPlayReference} onReferenceVolumeChange={setReferenceVolume} onMetronomeChange={setMetronome} onInitialCueChange={setInitialCue} onInitialCueBeatsChange={setInitialCueBeats} onCountInBeatsChange={setCountInBeats} /></header>
    <input ref={inputRef} type="file" accept=".mid,.midi,.json,audio/midi,audio/x-midi,application/json" hidden onChange={(event) => void loadFile(event.target.files?.[0])} />
    {error && <p className="error" role="alert">{error}</p>}
    {countdown !== undefined && <div className="countdown" role="status"><span>Prepare-se</span><strong>{countdown}</strong></div>}
    <CurrentNote expected={expected} detected={detected} differenceCents={difference} volume={volume} naming={noteNaming} />
    <MusicViewControls view={musicView} naming={noteNaming} clef={clefPreference} keySignature={keySignaturePreference} bpm={track.tempoChanges?.[0]?.bpm ?? track.bpm ?? 60} hasLyrics={track.notes.some((note) => Boolean(note.lyric?.trim()))} disabled={running} onViewChange={setMusicView} onNamingChange={setNoteNaming} onClefChange={setClefPreference} onKeySignatureChange={setKeySignaturePreference} onBpmChange={changeBpm} onAddNote={addNote} />
    {musicView === 'timeline' ? <PitchVisualizer track={track} frames={frames} elapsed={elapsed} running={running} naming={noteNaming} selectedNoteId={selectedNoteId} onSelectNote={selectNote} /> : <SheetMusic track={track} elapsed={elapsed} running={running} naming={noteNaming} clefPreference={clefPreference} keySignaturePreference={keySignaturePreference} selectedNoteId={selectedNoteId} onSelectNote={selectNote} />}
    <progress className="progress" max={trackDuration(track)} value={Math.min(elapsed, trackDuration(track))} aria-label="Progresso do exercício" />
    {selectedNote && !running && <NoteEditor key={selectedNote.id} note={selectedNote} naming={noteNaming} canDelete={track.notes.length > 1} onSave={saveNote} onDelete={deleteNote} onClose={() => setSelectedNoteId(undefined)} />}
    {score && <ScorePanel score={score} />}
    {playReference && <p className="headphone-tip">🎧 Use fones de ouvido para que a referência não seja captada pelo microfone.</p>}
    <p className="privacy">O áudio é analisado no seu navegador e não é gravado nem enviado.</p>
  </main>
}
