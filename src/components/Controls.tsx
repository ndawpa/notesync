interface Props {
  running: boolean
  hasResults: boolean
  playReference: boolean
  referenceVolume: number
  metronome: boolean
  initialCue: boolean
  countInBeats: number
  onLoad: () => void
  onStart: () => void
  onStop: () => void
  onReset: () => void
  onPlayReferenceChange: (enabled: boolean) => void
  onReferenceVolumeChange: (volume: number) => void
  onMetronomeChange: (enabled: boolean) => void
  onInitialCueChange: (enabled: boolean) => void
  onCountInBeatsChange: (beats: number) => void
}

export function Controls({ running, hasResults, playReference, referenceVolume, metronome, initialCue, countInBeats, onLoad, onStart, onStop, onReset, onPlayReferenceChange, onReferenceVolumeChange, onMetronomeChange, onInitialCueChange, onCountInBeatsChange }: Props) {
  return <div className="control-area">
    <div className="controls">
      <button onClick={onLoad} disabled={running}>Carregar exercício</button>
      <button className="primary" onClick={onStart} disabled={running}>Iniciar</button>
      <button onClick={onStop} disabled={!running}>Parar</button>
      <button onClick={onReset} disabled={running && !hasResults}>Reiniciar</button>
    </div>
    <div className="reference-controls">
      <label><input type="checkbox" checked={playReference} disabled={running} onChange={(event) => onPlayReferenceChange(event.target.checked)} /> Tocar referência</label>
      <label><input type="checkbox" checked={metronome} disabled={running} onChange={(event) => onMetronomeChange(event.target.checked)} /> Metrônomo</label>
      <label><input type="checkbox" checked={initialCue} disabled={running} onChange={(event) => onInitialCueChange(event.target.checked)} /> Tom inicial</label>
      <label>Contagem
        <select value={countInBeats} disabled={running} onChange={(event) => onCountInBeatsChange(Number(event.target.value))}>
          <option value="0">Sem contagem</option><option value="2">2 tempos</option><option value="4">4 tempos</option><option value="8">8 tempos</option>
        </select>
      </label>
      <label className="reference-volume">Volume
        <input type="range" min="0" max="100" value={Math.round(referenceVolume * 100)} disabled={running || !playReference} onChange={(event) => onReferenceVolumeChange(Number(event.target.value) / 100)} />
        <span>{Math.round(referenceVolume * 100)}%</span>
      </label>
    </div>
  </div>
}
