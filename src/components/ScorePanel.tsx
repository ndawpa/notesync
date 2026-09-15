import type { SessionScore } from '../scoring/overallScore'

export function ScorePanel({ score }: { score: SessionScore }) {
  const percent = (value: number) => `${Math.round(value)}%`
  const exportCsv = () => {
    const rows = [['compasso', 'nota', 'status', 'cents', 'entrada_ms', 'duracao_ms'], ...score.noteDetails.map((detail) => [detail.measure, detail.pitch, detail.status, detail.cents ?? '', detail.onsetErrorMs ?? '', detail.durationErrorMs ?? ''])]
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'relatorio-notesync.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <section className="score-panel">
    <h2>Resultado</h2>
    {score.notesDetected === 0 && <p className="no-voice">Nenhuma voz foi detectada durante o exercício. Todas as notas foram consideradas perdidas.</p>}
    <div className="score-head"><div><span>Afinação</span><strong>{percent(score.pitch)}</strong></div><div><span>Ritmo</span><strong>{percent(score.rhythm)}</strong></div><div className="overall"><span>Score geral</span><strong>{percent(score.overall)}</strong></div></div>
    <dl><div><dt>Notas da referência</dt><dd>{score.notesEvaluated}</dd></div><div><dt>Notas detectadas</dt><dd>{score.notesDetected}</dd></div><div><dt>Notas perdidas</dt><dd>{score.notesMissed}</dd></div><div><dt>Notas acertadas</dt><dd>{score.notesHit}</dd></div><div><dt>Acima</dt><dd>{score.above}</dd></div><div><dt>Abaixo</dt><dd>{score.below}</dd></div><div><dt>Maior erro</dt><dd>{score.maxErrorCents.toFixed(1)} cents</dd></div><div><dt>Erro médio</dt><dd>{score.averageErrorCents.toFixed(1)} cents</dd></div></dl>
    <div className="note-report"><h3>Detalhes por nota</h3><button onClick={exportCsv}>Exportar relatório CSV</button><div className="report-scroll"><table><thead><tr><th>Compasso</th><th>Nota</th><th>Afinação</th><th>Entrada</th><th>Duração</th></tr></thead><tbody>{score.noteDetails.map((detail) => <tr className={detail.status} key={detail.noteId}><td>{detail.measure}</td><td>{detail.pitch}</td><td>{detail.cents === undefined ? 'Não detectada' : `${detail.cents > 0 ? '+' : ''}${detail.cents.toFixed(1)} cents`}</td><td>{detail.onsetErrorMs === undefined ? '—' : `${detail.onsetErrorMs > 0 ? '+' : ''}${Math.round(detail.onsetErrorMs)} ms`}</td><td>{detail.durationErrorMs === undefined ? '—' : `${detail.durationErrorMs > 0 ? '+' : ''}${Math.round(detail.durationErrorMs)} ms`}</td></tr>)}</tbody></table></div></div>
  </section>
}
