import { useEffect, useRef, useState } from 'react'
import { MicrophoneInput } from './audio/microphone'
import { ReferencePlayer } from './audio/referencePlayer'
import { detectPitchYin, medianFrequency, rootMeanSquare } from './audio/pitchDetector'
import { Controls } from './components/Controls'
import { CurrentNote } from './components/CurrentNote'
import { PitchVisualizer } from './components/PitchVisualizer'
import { ScorePanel } from './components/ScorePanel'
import { frequencyDifferenceInCents, frequencyToMidi, frequencyToMidiFloat, midiToFrequency, midiToNoteName } from './music/noteUtils'
import { DEFAULT_TRACK, noteAtTime, parseReferenceTrack, trackDuration } from './music/referenceTrack'
import { parseMidiFile } from './music/midiParser'
import { calculateSessionScore, type SessionScore } from './scoring/overallScore'
import type { EvaluatedFrame, PitchFrame } from './types/audio'
import type { ReferenceTrack } from './types/music'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const microphoneRef = useRef<MicrophoneInput | undefined>(undefined)
  const referencePlayerRef = useRef<ReferencePlayer | undefined>(undefined)
  const animationRef = useRef<number | undefined>(undefined)
  const framesRef = useRef<EvaluatedFrame[]>([])
  const trackRef = useRef(track)
  const historyRef = useRef<Array<{ frequency: number; timestamp: number }>>([])
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
    setScore(calculateSessionScore(trackRef.current, completedFrames))
    const microphone = microphoneRef.current
    microphoneRef.current = undefined
    await microphone?.close()
  }

  const start = async () => {
    setError(''); setScore(undefined); setFrames([]); setElapsed(0); setDetected(undefined)
    framesRef.current = []; historyRef.current = []; lastRenderRef.current = 0
    try {
      const microphone = await MicrophoneInput.create()
      microphoneRef.current = microphone
      const startedAt = microphone.context.currentTime + 0.15
      if (playReference) {
        const player = new ReferencePlayer(microphone.context, referenceVolume)
        player.schedule(trackRef.current, startedAt)
        referencePlayerRef.current = player
      }
      setRunning(true)
      const analyse = () => {
        const mic = microphoneRef.current
        if (!mic) return
        const now = mic.context.currentTime - startedAt
        if (now < 0) { animationRef.current = requestAnimationFrame(analyse); return }
        if (now >= trackDuration(trackRef.current)) { setElapsed(trackDuration(trackRef.current)); void finish(); return }
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
        if (now - lastRenderRef.current > 0.05) { setElapsed(now); setFrames([...framesRef.current]); lastRenderRef.current = now }
        animationRef.current = requestAnimationFrame(analyse)
      }
      animationRef.current = requestAnimationFrame(analyse)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível acessar o microfone.'); setRunning(false) }
  }

  const reset = () => { setElapsed(0); setFrames([]); setScore(undefined); setDetected(undefined); setVolume(0); framesRef.current = [] }
  const expected = noteAtTime(track, elapsed)
  const currentEvaluated = frames.at(-1)
  const difference = currentEvaluated && currentEvaluated.expectedNoteId === expected?.id ? currentEvaluated.differenceCents : undefined

  const loadFile = async (file?: File) => {
    if (!file) return
    try {
      const isMidi = /\.(mid|midi)$/i.test(file.name)
      const next = isMidi ? parseMidiFile(await file.arrayBuffer(), file.name) : parseReferenceTrack(JSON.parse(await file.text()))
      setTrack(next); reset(); setError('')
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível ler o exercício.') }
    finally { if (inputRef.current) inputRef.current.value = '' }
  }

  return <main>
    <header><div><p className="eyebrow">Treinamento vocal</p><h1>{track.name}</h1><p>{track.bpm ? `${track.bpm} BPM · ` : ''}{track.notes.length} notas · {trackDuration(track).toFixed(1)} segundos</p></div><Controls running={running} hasResults={Boolean(score)} playReference={playReference} referenceVolume={referenceVolume} onLoad={() => inputRef.current?.click()} onStart={() => void start()} onStop={() => void finish()} onReset={reset} onPlayReferenceChange={setPlayReference} onReferenceVolumeChange={setReferenceVolume} /></header>
    <input ref={inputRef} type="file" accept=".mid,.midi,.json,audio/midi,audio/x-midi,application/json" hidden onChange={(event) => void loadFile(event.target.files?.[0])} />
    {error && <p className="error" role="alert">{error}</p>}
    <CurrentNote expected={expected} detected={detected} differenceCents={difference} volume={volume} />
    <PitchVisualizer track={track} frames={frames} elapsed={elapsed} />
    <progress className="progress" max={trackDuration(track)} value={Math.min(elapsed, trackDuration(track))} aria-label="Progresso do exercício" />
    {score && <ScorePanel score={score} />}
    {playReference && <p className="headphone-tip">🎧 Use fones de ouvido para que a referência não seja captada pelo microfone.</p>}
    <p className="privacy">O áudio é analisado no seu navegador e não é gravado nem enviado.</p>
  </main>
}
