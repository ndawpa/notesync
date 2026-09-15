interface Props {
  running: boolean
  processing: boolean
  hasResults: boolean
  evaluationMode: 'pitch-rhythm' | 'solfege'
  playReference: boolean
  referenceVolume: number
  metronome: boolean
  initialCue: boolean
  initialCueBeats: number
  countInBeats: number
  onLoad: () => void
  onStart: () => void
  onStop: () => void
  onReset: () => void
  onEvaluationModeChange: (mode: 'pitch-rhythm' | 'solfege') => void
  onPlayReferenceChange: (enabled: boolean) => void
  onReferenceVolumeChange: (volume: number) => void
  onMetronomeChange: (enabled: boolean) => void
  onInitialCueChange: (enabled: boolean) => void
  onInitialCueBeatsChange: (beats: number) => void
  onCountInBeatsChange: (beats: number) => void
}

export function Controls({ running, processing, hasResults, evaluationMode, playReference, referenceVolume, metronome, initialCue, initialCueBeats, countInBeats, onLoad, onStart, onStop, onReset, onEvaluationModeChange, onPlayReferenceChange, onReferenceVolumeChange, onMetronomeChange, onInitialCueChange, onInitialCueBeatsChange, onCountInBeatsChange }: Props) {
  return <div className="control-area">
    <div className="controls">
      <button onClick={onLoad} disabled={running || processing}>Carregar exercício</button>
      <button className="primary" onClick={onStart} disabled={running || processing}>Iniciar</button>
      <button onClick={onStop} disabled={!running}>Parar</button>
      <button onClick={onReset} disabled={processing || (running && !hasResults)}>Reiniciar</button>
    </div>
    <div className="reference-controls">
      <label>Modo de avaliação<select value={evaluationMode} disabled={running || processing} onChange={(event) => onEvaluationModeChange(event.target.value as 'pitch-rhythm' | 'solfege')}><option value="pitch-rhythm">Afinação e ritmo</option><option value="solfege">Solfejo</option></select></label>
      <label><input type="checkbox" checked={playReference} disabled={running} onChange={(event) => onPlayReferenceChange(event.target.checked)} /> Tocar referência</label>
      <label><input type="checkbox" checked={metronome} disabled={running} onChange={(event) => onMetronomeChange(event.target.checked)} /> Metrônomo</label>
      <label><input type="checkbox" checked={initialCue} disabled={running} onChange={(event) => onInitialCueChange(event.target.checked)} /> Tom inicial</label>
      <label>Duração do tom
        <select value={initialCueBeats} disabled={running || !initialCue} onChange={(event) => onInitialCueBeatsChange(Number(event.target.value))}>
          <option value="1">1 tempo</option><option value="2">2 tempos</option><option value="4">4 tempos</option><option value="8">8 tempos</option>
        </select>
      </label>
      <label>Contagem
        <select value={countInBeats} disabled={running} onChange={(event) => onCountInBeatsChange(Number(event.target.value))}>
          <option value="0">Sem contagem</option><option value="2">2 tempos</option><option value="4">4 tempos</option><option value="8">8 tempos</option>
        </select>
      </label>
      <label className="reference-volume">Volume dos sons
        <input type="range" min="0" max="100" value={Math.round(referenceVolume * 100)} disabled={running || (!playReference && !metronome && !initialCue)} onChange={(event) => onReferenceVolumeChange(Number(event.target.value) / 100)} />
        <span>{Math.round(referenceVolume * 100)}%</span>
      </label>
    </div>
  </div>
}
