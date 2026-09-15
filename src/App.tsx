import { useEffect, useRef, useState } from 'react'
import { MicrophoneInput } from './audio/microphone'
import { ReferencePlayer } from './audio/referencePlayer'
import { recordingTo16kMono, SolfegeRecognizer } from './audio/solfegeRecognizer'
import { detectPitchYin, medianFrequency, rootMeanSquare } from './audio/pitchDetector'
import { Controls } from './components/Controls'
import { CurrentNote } from './components/CurrentNote'
import { PitchVisualizer } from './components/PitchVisualizer'
import { SheetMusic } from './components/SheetMusic'
import { MusicViewControls } from './components/MusicViewControls'
import { NoteEditor } from './components/NoteEditor'
import { ScorePanel } from './components/ScorePanel'
import { SolfegeScorePanel } from './components/SolfegeScorePanel'
import { PracticeControls } from './components/PracticeControls'
import { frequencyDifferenceInCents, frequencyToMidi, frequencyToMidiFloat, midiToFrequency, midiToNoteName } from './music/noteUtils'
import { changeTrackBpm, DEFAULT_TRACK, noteAtTime, parseReferenceTrack, trackDuration } from './music/referenceTrack'
import { parseMidiTracks } from './music/midiParser'
import { calculateSessionScore, type SessionScore } from './scoring/overallScore'
import { scoreTimedSolfege, type SolfegeScore, type SolfegeSystem } from './scoring/solfegeScoring'
import type { EvaluatedFrame, PitchFrame } from './types/audio'
import type { MusicView, NoteNaming, ReferenceNote, ReferenceTrack, ScoreLayout } from './types/music'
import type { ClefPreference, KeySignaturePreference } from './music/notationUtils'
import { correctOctaveFrequency, extractMeasureRange, suggestTransposition, trackMidiRange, transposeTrack, VOCAL_RANGES } from './music/practiceUtils'
import { measureRanges } from './music/timingUtils'
import { parseMusicXmlFile } from './music/musicXmlParser'

interface SavedSettings { musicView?: MusicView; scoreLayout?: ScoreLayout; noteNaming?: NoteNaming; clef?: ClefPreference; key?: KeySignaturePreference; referenceVolume?: number; latencyMs?: number; noiseThreshold?: number; vocalRange?: keyof typeof VOCAL_RANGES }
function loadSavedTrack() { try { const value = localStorage.getItem('notesync-track'); return value ? parseReferenceTrack(JSON.parse(value)) : DEFAULT_TRACK } catch { return DEFAULT_TRACK } }
function loadSavedSettings(): SavedSettings { try { return JSON.parse(localStorage.getItem('notesync-settings') || '{}') as SavedSettings } catch { return {} } }

export default function App() {
  const [savedSettings] = useState(loadSavedSettings)
  const [track, setTrack] = useState<ReferenceTrack>(loadSavedTrack)
  const [sessionTrack, setSessionTrack] = useState<ReferenceTrack>(track)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [volume, setVolume] = useState(0)
  const [detected, setDetected] = useState<PitchFrame>()
  const [frames, setFrames] = useState<EvaluatedFrame[]>([])
  const [score, setScore] = useState<SessionScore>()
  const [solfegeScore, setSolfegeScore] = useState<SolfegeScore>()
  const [evaluationMode, setEvaluationMode] = useState<'pitch-rhythm' | 'solfege'>('pitch-rhythm')
  const [processingSolfege, setProcessingSolfege] = useState(false)
  const [solfegeStatus, setSolfegeStatus] = useState('')
  const [error, setError] = useState('')
  const [playReference, setPlayReference] = useState(true)
  const [referenceVolume, setReferenceVolume] = useState(savedSettings.referenceVolume ?? 0.35)
  const [metronome, setMetronome] = useState(true)
  const [initialCue, setInitialCue] = useState(true)
  const [initialCueBeats, setInitialCueBeats] = useState(4)
  const [countInBeats, setCountInBeats] = useState(4)
  const [musicView, setMusicView] = useState<MusicView>(savedSettings.musicView ?? 'score')
  const [scoreLayout, setScoreLayout] = useState<ScoreLayout>(savedSettings.scoreLayout ?? 'continuous')
  const [noteNaming, setNoteNaming] = useState<NoteNaming>(savedSettings.noteNaming ?? 'hidden')
  const [clefPreference, setClefPreference] = useState<ClefPreference>(savedSettings.clef ?? 'auto')
  const [keySignaturePreference, setKeySignaturePreference] = useState<KeySignaturePreference>(savedSettings.key ?? 'auto')
  const [selectedNoteId, setSelectedNoteId] = useState<string>()
  const [countdown, setCountdown] = useState<number>()
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopStart, setLoopStart] = useState(1)
  const [loopEnd, setLoopEnd] = useState(1)
  const [progressive, setProgressive] = useState(false)
  const [tempoPercent, setTempoPercent] = useState(70)
  const [octaveCorrection, setOctaveCorrection] = useState(true)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [latencyMs, setLatencyMs] = useState(savedSettings.latencyMs ?? 0)
  const [noiseThreshold, setNoiseThreshold] = useState(savedSettings.noiseThreshold ?? 0.012)
  const [midiTracks, setMidiTracks] = useState<ReferenceTrack[]>([])
  const [selectedMidiTrack, setSelectedMidiTrack] = useState(0)
  const [calibrating, setCalibrating] = useState(false)
  const [loopIteration, setLoopIteration] = useState(1)
  const [vocalRange, setVocalRange] = useState<keyof typeof VOCAL_RANGES>(savedSettings.vocalRange ?? 'tenor')
  const [solfegeSystem, setSolfegeSystem] = useState<SolfegeSystem>('fixed')
  const [solfegeModelReady, setSolfegeModelReady] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const microphoneRef = useRef<MicrophoneInput | undefined>(undefined)
  const referencePlayerRef = useRef<ReferencePlayer | undefined>(undefined)
  const solfegeRecognizerRef = useRef<SolfegeRecognizer | undefined>(undefined)
  const animationRef = useRef<number | undefined>(undefined)
  const framesRef = useRef<EvaluatedFrame[]>([])
  const trackRef = useRef(track)
  const sessionTrackRef = useRef(track)
  const historyRef = useRef<Array<{ frequency: number; timestamp: number }>>([])
  const lastAnalysisRef = useRef(0)
  const lastRenderRef = useRef(0)
  const recordingTrimRef = useRef(0)
  const recordingStartedAtRef = useRef(0)

  useEffect(() => { trackRef.current = track }, [track])
  useEffect(() => { navigator.mediaDevices?.enumerateDevices().then((items) => setDevices(items.filter((item) => item.kind === 'audioinput'))).catch(() => undefined) }, [])
  useEffect(() => { localStorage.setItem('notesync-track', JSON.stringify(track)) }, [track])
  useEffect(() => { localStorage.setItem('notesync-settings', JSON.stringify({ musicView, scoreLayout, noteNaming, clef: clefPreference, key: keySignaturePreference, referenceVolume, latencyMs, noiseThreshold, vocalRange })) }, [musicView, scoreLayout, noteNaming, clefPreference, keySignaturePreference, referenceVolume, latencyMs, noiseThreshold, vocalRange])
  useEffect(() => () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); referencePlayerRef.current?.stop(); solfegeRecognizerRef.current?.terminate(); void microphoneRef.current?.close() }, [])

  const finish = async () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    animationRef.current = undefined
    const completedFrames = framesRef.current
    referencePlayerRef.current?.stop()
    referencePlayerRef.current = undefined
    setRunning(false)
    setCountdown(undefined)
    const microphone = microphoneRef.current
    microphoneRef.current = undefined
    const recording = evaluationMode === 'solfege' ? await microphone?.stopRecording() : undefined
    await microphone?.close()
    if (evaluationMode === 'pitch-rhythm') {
      const result = calculateSessionScore(sessionTrackRef.current, completedFrames)
      setScore(result)
      if (progressive && result.overall >= 85) setTempoPercent((value) => Math.min(100, value + 5))
      return
    }
    if (!recording?.size) { setError('Nenhum áudio foi capturado para avaliar o solfejo.'); return }
    setProcessingSolfege(true)
    setSolfegeStatus('Preparando o áudio…')
    try {
      const audio = await recordingTo16kMono(recording, recordingTrimRef.current)
      solfegeRecognizerRef.current ??= new SolfegeRecognizer()
      const recognition = await solfegeRecognizerRef.current.recognize(audio, setSolfegeStatus)
      setSolfegeModelReady(true)
      setSolfegeScore(scoreTimedSolfege(sessionTrackRef.current, recognition, solfegeSystem))
    } catch (reason) {
      setError(reason instanceof Error ? `Não foi possível avaliar o solfejo: ${reason.message}` : 'Não foi possível avaliar o solfejo.')
    } finally {
      setProcessingSolfege(false); setSolfegeStatus('')
    }
  }

  const start = async () => {
    setError(''); setScore(undefined); setSolfegeScore(undefined); setFrames([]); setElapsed(0); setDetected(undefined)
    framesRef.current = []; historyRef.current = []; lastAnalysisRef.current = 0; lastRenderRef.current = 0
    try {
      const microphone = await MicrophoneInput.create(deviceId)
      microphoneRef.current = microphone
      if (evaluationMode === 'solfege') { microphone.startRecording(); recordingStartedAtRef.current = microphone.context.currentTime }
      const loopTrack = loopEnabled ? extractMeasureRange(trackRef.current, loopStart, loopEnd) : trackRef.current
      let currentTempoPercent = progressive ? tempoPercent : 100
      let practiceTrack = currentTempoPercent < 100 ? changeTrackBpm(loopTrack, (loopTrack.tempoChanges?.[0]?.bpm ?? loopTrack.bpm ?? 60) * currentTempoPercent / 100) : loopTrack
      sessionTrackRef.current = practiceTrack
      setSessionTrack(practiceTrack)
      const initialBpm = practiceTrack.tempoChanges?.[0]?.bpm ?? practiceTrack.bpm ?? 60
      const initialSignature = practiceTrack.timeSignatures?.[0]
      const pulseBeats = initialSignature?.clocksPerClick ? initialSignature.clocksPerClick / 24 : (initialSignature && initialSignature.numerator > 3 && initialSignature.numerator % 3 === 0 ? 1.5 : 4 / (initialSignature?.denominator ?? 4))
      const beatDuration = 60 / initialBpm * pulseBeats
      const countStartedAt = microphone.context.currentTime + 0.15
      const preparationBeats = Math.max(countInBeats, initialCue ? initialCueBeats : 0)
      const preparationDuration = preparationBeats * beatDuration
      let startedAt = countStartedAt + preparationDuration
      recordingTrimRef.current = Math.max(0, startedAt - recordingStartedAtRef.current)
      const scheduleCycle = (cycleTrack: ReferenceTrack, cycleStartedAt: number, includePreparation: boolean) => {
        referencePlayerRef.current?.stop()
        referencePlayerRef.current = undefined
        if (!(playReference || metronome || (includePreparation && initialCue))) return
        const player = new ReferencePlayer(microphone.context, referenceVolume)
        if (playReference) player.schedule(cycleTrack, cycleStartedAt)
        if (metronome) player.scheduleMetronome(cycleTrack, cycleStartedAt, includePreparation ? cycleStartedAt - countInBeats * beatDuration : cycleStartedAt, includePreparation ? countInBeats : 0)
        if (includePreparation && initialCue && cycleTrack.notes[0]) player.scheduleCue(cycleTrack.notes[0].midi, countStartedAt + 0.05, Math.max(0.2, initialCueBeats * beatDuration - 0.1))
        referencePlayerRef.current = player
      }
      scheduleCycle(practiceTrack, startedAt, true)
      setLoopIteration(1)
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
        if (now >= trackDuration(sessionTrackRef.current)) {
          setElapsed(trackDuration(sessionTrackRef.current))
          if (loopEnabled && evaluationMode === 'pitch-rhythm') {
            const cycleScore = calculateSessionScore(sessionTrackRef.current, framesRef.current)
            setScore(cycleScore)
            if (progressive && cycleScore.overall >= 85 && currentTempoPercent < 100) {
              currentTempoPercent = Math.min(100, currentTempoPercent + 5)
              setTempoPercent(currentTempoPercent)
              practiceTrack = changeTrackBpm(loopTrack, (loopTrack.tempoChanges?.[0]?.bpm ?? loopTrack.bpm ?? 60) * currentTempoPercent / 100)
              sessionTrackRef.current = practiceTrack
              setSessionTrack(practiceTrack)
            }
            framesRef.current = []; historyRef.current = []; lastAnalysisRef.current = 0; lastRenderRef.current = 0
            setFrames([]); setDetected(undefined); setElapsed(0); setLoopIteration((value) => value + 1)
            startedAt = mic.context.currentTime + 0.08
            scheduleCycle(practiceTrack, startedAt, false)
            animationRef.current = requestAnimationFrame(analyse)
            return
          }
          void finish(); return
        }
        setElapsed(now)
        if (now - lastAnalysisRef.current < 1 / 30) { animationRef.current = requestAnimationFrame(analyse); return }
        lastAnalysisRef.current = now
        const samples = mic.readSamples()
        setVolume(rootMeanSquare(samples))
        const result = mic.usesAudioWorklet ? mic.readPitchDetection(noiseThreshold) : detectPitchYin(samples, mic.context.sampleRate, noiseThreshold)
        const analysisTime = Math.max(0, now - latencyMs / 1000)
        const expected = noteAtTime(sessionTrackRef.current, analysisTime)
        if (result) {
          const correctedFrequency = octaveCorrection && expected ? correctOctaveFrequency(result.frequency, expected.midi) : result.frequency
          historyRef.current.push({ frequency: correctedFrequency, timestamp: now })
          historyRef.current = historyRef.current.filter((item) => now - item.timestamp <= 0.15)
          const frequency = medianFrequency(historyRef.current, now)
          const nearestMidi = frequencyToMidi(frequency)
          const pitchFrame: PitchFrame = { frequency, midi: frequencyToMidiFloat(frequency), note: midiToNoteName(nearestMidi), cents: frequencyDifferenceInCents(frequency, midiToFrequency(nearestMidi)), confidence: result.confidence, timestamp: analysisTime, volume: result.volume }
          setDetected(pitchFrame)
          if (expected) framesRef.current.push({ ...pitchFrame, expectedNoteId: expected.id, expectedMidi: expected.midi, differenceCents: frequencyDifferenceInCents(frequency, midiToFrequency(expected.midi)) })
        } else setDetected(undefined)
        if (now - lastRenderRef.current > 0.05) { setFrames([...framesRef.current]); lastRenderRef.current = now }
        animationRef.current = requestAnimationFrame(analyse)
      }
      animationRef.current = requestAnimationFrame(analyse)
    } catch (reason) {
      referencePlayerRef.current?.stop(); referencePlayerRef.current = undefined
      const microphone = microphoneRef.current; microphoneRef.current = undefined
      await microphone?.close()
      setError(reason instanceof Error ? reason.message : 'Não foi possível acessar o microfone.'); setRunning(false)
    }
  }

  const reset = () => { setElapsed(0); setFrames([]); setScore(undefined); setSolfegeScore(undefined); setDetected(undefined); setVolume(0); setCountdown(undefined); setError(''); setLoopIteration(1); framesRef.current = [] }
  const expected = noteAtTime(running ? sessionTrack : track, elapsed)
  const currentEvaluated = frames.at(-1)
  const difference = currentEvaluated && currentEvaluated.expectedNoteId === expected?.id ? currentEvaluated.differenceCents : undefined

  const loadFile = async (file?: File) => {
    if (!file) return
    try {
      const isMidi = /\.(mid|midi)$/i.test(file.name), isMusicXml = /\.(musicxml|xml|mxl)$/i.test(file.name)
      const parsedTracks = isMidi ? parseMidiTracks(await file.arrayBuffer(), file.name) : isMusicXml ? parseMusicXmlFile(await file.arrayBuffer(), file.name) : []
      const next = isMidi || isMusicXml ? parsedTracks[0] : parseReferenceTrack(JSON.parse(await file.text()))
      setMidiTracks(parsedTracks); setSelectedMidiTrack(0)
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
  const changeEvaluationMode = (mode: 'pitch-rhythm' | 'solfege') => { setEvaluationMode(mode); if (mode === 'solfege') setNoteNaming('solfege'); reset() }
  const transpose = (semitones: number) => { setTrack((current) => transposeTrack(current, semitones)); reset() }
  const exportTrack = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(track, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `${track.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'exercicio'}.json`; link.click(); URL.revokeObjectURL(url) }
  const selectMidiTrack = (index: number) => { const selected = midiTracks[index]; if (!selected) return; setSelectedMidiTrack(index); setTrack(selected); setSelectedNoteId(undefined); reset() }
  const calibrate = async () => {
    setCalibrating(true); setError('')
    let microphone: MicrophoneInput | undefined
    try {
      microphone = await MicrophoneInput.create(deviceId)
      const levels: number[] = []
      for (let index = 0; index < 20; index++) { await new Promise((resolve) => setTimeout(resolve, 75)); levels.push(rootMeanSquare(microphone.readSamples())) }
      levels.sort((a, b) => a - b)
      setNoiseThreshold(Math.max(0.005, Math.min(0.08, (levels[Math.floor(levels.length * 0.9)] ?? 0.005) * 2.5)))
      const contextWithOutput = microphone.context as AudioContext & { outputLatency?: number }
      setLatencyMs(Math.round(((microphone.context.baseLatency || 0) + (contextWithOutput.outputLatency || 0)) * 1000))
      const available = await navigator.mediaDevices.enumerateDevices(); setDevices(available.filter((item) => item.kind === 'audioinput'))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível calibrar o microfone.') }
    finally { await microphone?.close(); setCalibrating(false) }
  }
  const preloadSolfege = async () => {
    setProcessingSolfege(true); setError(''); setSolfegeStatus('Preparando o reconhecimento…')
    try { solfegeRecognizerRef.current ??= new SolfegeRecognizer(); await solfegeRecognizerRef.current.preload(setSolfegeStatus); setSolfegeModelReady(true) }
    catch (reason) { setError(reason instanceof Error ? `Não foi possível preparar o solfejo: ${reason.message}` : 'Não foi possível preparar o solfejo.') }
    finally { setProcessingSolfege(false); setSolfegeStatus('') }
  }
  const selectedNote = track.notes.find((note) => note.id === selectedNoteId)
  const measures = measureRanges(track, trackDuration(track))
  const activeTrack = running ? sessionTrack : track
  const exerciseRange = trackMidiRange(track)
  const suggestedTranspose = suggestTransposition(track, VOCAL_RANGES[vocalRange])
  const rangeSummary = exerciseRange ? `${midiToNoteName(exerciseRange.min)}–${midiToNoteName(exerciseRange.max)}` : '—'

  return <main>
    <header><div><p className="eyebrow">Treinamento vocal</p><h1>{track.name}</h1><p>{track.bpm ? `${track.bpm} BPM · ` : ''}{track.notes.length} notas · {trackDuration(track).toFixed(1)} segundos</p></div><Controls running={running} processing={processingSolfege} hasResults={Boolean(score || solfegeScore)} evaluationMode={evaluationMode} playReference={playReference} referenceVolume={referenceVolume} metronome={metronome} initialCue={initialCue} initialCueBeats={initialCueBeats} countInBeats={countInBeats} onLoad={() => inputRef.current?.click()} onStart={() => void start()} onStop={() => void finish()} onReset={reset} onEvaluationModeChange={changeEvaluationMode} onPlayReferenceChange={setPlayReference} onReferenceVolumeChange={setReferenceVolume} onMetronomeChange={setMetronome} onInitialCueChange={setInitialCue} onInitialCueBeatsChange={setInitialCueBeats} onCountInBeatsChange={setCountInBeats} /></header>
    <input ref={inputRef} type="file" accept=".mid,.midi,.json,.xml,.musicxml,.mxl,audio/midi,audio/x-midi,application/json,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml" hidden onChange={(event) => void loadFile(event.target.files?.[0])} />
    {error && <p className="error" role="alert">{error}</p>}
    {processingSolfege && <p className="processing" role="status"><span className="spinner" />{solfegeStatus}</p>}
    {countdown !== undefined && <div className="countdown" role="status"><span>Prepare-se</span><strong>{countdown}</strong></div>}
    {running && loopEnabled && <p className="loop-status" role="status">Repetição {loopIteration}{progressive ? ` · ${tempoPercent}% do andamento` : ''}</p>}
    <CurrentNote expected={expected} detected={detected} differenceCents={difference} volume={volume} naming={noteNaming} />
    <PracticeControls disabled={running || processingSolfege} measureCount={measures.length} loopEnabled={loopEnabled} loopStart={loopStart} loopEnd={Math.max(loopStart, loopEnd)} progressive={progressive} tempoPercent={tempoPercent} onLoopEnabledChange={setLoopEnabled} onLoopStartChange={(value) => { setLoopStart(value); if (loopEnd < value) setLoopEnd(value) }} onLoopEndChange={setLoopEnd} onProgressiveChange={setProgressive} onTempoPercentChange={setTempoPercent} onTranspose={transpose} onExport={exportTrack} devices={devices} deviceId={deviceId} latencyMs={latencyMs} noiseThreshold={noiseThreshold} onDeviceChange={setDeviceId} onLatencyChange={setLatencyMs} onNoiseThresholdChange={setNoiseThreshold} midiTracks={midiTracks.map((item) => item.name)} selectedMidiTrack={selectedMidiTrack} onMidiTrackChange={selectMidiTrack} calibrating={calibrating} onCalibrate={() => void calibrate()} vocalRange={vocalRange} rangeSummary={rangeSummary} suggestedTranspose={suggestedTranspose} onVocalRangeChange={(value) => setVocalRange(value as keyof typeof VOCAL_RANGES)} onApplySuggestedTranspose={() => transpose(suggestedTranspose)} evaluationMode={evaluationMode} solfegeSystem={solfegeSystem} solfegeModelReady={solfegeModelReady} onSolfegeSystemChange={setSolfegeSystem} onPreloadSolfege={() => void preloadSolfege()} />
    <label className="octave-correction"><input type="checkbox" checked={octaveCorrection} disabled={running} onChange={(event) => setOctaveCorrection(event.target.checked)} /> Correção contextual de erros de oitava</label>
    <MusicViewControls view={musicView} scoreLayout={scoreLayout} naming={noteNaming} clef={clefPreference} keySignature={keySignaturePreference} bpm={track.tempoChanges?.[0]?.bpm ?? track.bpm ?? 60} hasLyrics={track.notes.some((note) => Boolean(note.lyric?.trim()))} disabled={running} onViewChange={setMusicView} onScoreLayoutChange={setScoreLayout} onNamingChange={setNoteNaming} onClefChange={setClefPreference} onKeySignatureChange={setKeySignaturePreference} onBpmChange={changeBpm} onAddNote={addNote} />
    {musicView === 'timeline' ? <PitchVisualizer track={activeTrack} frames={frames} elapsed={elapsed} running={running} naming={noteNaming} selectedNoteId={selectedNoteId} onSelectNote={selectNote} /> : <SheetMusic track={activeTrack} elapsed={elapsed} running={running} naming={noteNaming} clefPreference={clefPreference} keySignaturePreference={keySignaturePreference} layout={scoreLayout} selectedNoteId={selectedNoteId} onSelectNote={selectNote} />}
    <progress className="progress" max={trackDuration(activeTrack)} value={Math.min(elapsed, trackDuration(activeTrack))} aria-label="Progresso do exercício" />
    {selectedNote && !running && <NoteEditor key={selectedNote.id} note={selectedNote} naming={noteNaming} canDelete={track.notes.length > 1} onSave={saveNote} onDelete={deleteNote} onClose={() => setSelectedNoteId(undefined)} />}
    {score && <ScorePanel score={score} />}
    {solfegeScore && <SolfegeScorePanel score={solfegeScore} />}
    {playReference && <p className="headphone-tip">🎧 Use fones de ouvido para que a referência não seja captada pelo microfone.</p>}
    <p className="privacy">{evaluationMode === 'solfege' ? 'No modo solfejo, o áudio é gravado temporariamente e processado localmente; ele não é enviado a um backend nem armazenado após a avaliação.' : 'O áudio é analisado no seu navegador e não é gravado nem enviado.'}</p>
  </main>
}
