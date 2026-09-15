import type { SessionScore } from '../scoring/overallScore'

export function ScorePanel({ score }: { score: SessionScore }) {
  const percent = (value: number) => `${Math.round(value)}%`
  return <section className="score-panel">
    <h2>Resultado</h2>
    {score.notesDetected === 0 && <p className="no-voice">Nenhuma voz foi detectada durante o exercício. Todas as notas foram consideradas perdidas.</p>}
    <div className="score-head"><div><span>Afinação</span><strong>{percent(score.pitch)}</strong></div><div><span>Ritmo</span><strong>{percent(score.rhythm)}</strong></div><div className="overall"><span>Score geral</span><strong>{percent(score.overall)}</strong></div></div>
    <dl><div><dt>Notas da referência</dt><dd>{score.notesEvaluated}</dd></div><div><dt>Notas detectadas</dt><dd>{score.notesDetected}</dd></div><div><dt>Notas perdidas</dt><dd>{score.notesMissed}</dd></div><div><dt>Notas acertadas</dt><dd>{score.notesHit}</dd></div><div><dt>Acima</dt><dd>{score.above}</dd></div><div><dt>Abaixo</dt><dd>{score.below}</dd></div><div><dt>Maior erro</dt><dd>{score.maxErrorCents.toFixed(1)} cents</dd></div><div><dt>Erro médio</dt><dd>{score.averageErrorCents.toFixed(1)} cents</dd></div></dl>
  </section>
}
