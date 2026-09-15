interface Props {
  running: boolean
  hasResults: boolean
  playReference: boolean
  referenceVolume: number
  onLoad: () => void
  onStart: () => void
  onStop: () => void
  onReset: () => void
  onPlayReferenceChange: (enabled: boolean) => void
  onReferenceVolumeChange: (volume: number) => void
}

export function Controls({ running, hasResults, playReference, referenceVolume, onLoad, onStart, onStop, onReset, onPlayReferenceChange, onReferenceVolumeChange }: Props) {
  return <div className="control-area">
    <div className="controls">
      <button onClick={onLoad} disabled={running}>Carregar exercício</button>
      <button className="primary" onClick={onStart} disabled={running}>Iniciar</button>
      <button onClick={onStop} disabled={!running}>Parar</button>
      <button onClick={onReset} disabled={running && !hasResults}>Reiniciar</button>
    </div>
    <div className="reference-controls">
      <label><input type="checkbox" checked={playReference} disabled={running} onChange={(event) => onPlayReferenceChange(event.target.checked)} /> Tocar referência</label>
      <label className="reference-volume">Volume
        <input type="range" min="0" max="100" value={Math.round(referenceVolume * 100)} disabled={running || !playReference} onChange={(event) => onReferenceVolumeChange(Number(event.target.value) / 100)} />
        <span>{Math.round(referenceVolume * 100)}%</span>
      </label>
    </div>
  </div>
}
