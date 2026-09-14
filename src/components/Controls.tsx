interface Props { running: boolean; hasResults: boolean; onLoad: () => void; onStart: () => void; onStop: () => void; onReset: () => void }

export function Controls({ running, hasResults, onLoad, onStart, onStop, onReset }: Props) {
  return <div className="controls">
    <button onClick={onLoad} disabled={running}>Carregar exercício</button>
    <button className="primary" onClick={onStart} disabled={running}>Iniciar</button>
    <button onClick={onStop} disabled={!running}>Parar</button>
    <button onClick={onReset} disabled={running && !hasResults}>Reiniciar</button>
  </div>
}
