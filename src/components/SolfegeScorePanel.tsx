import type { SolfegeScore } from '../scoring/solfegeScoring'

export function SolfegeScorePanel({ score }: { score: SolfegeScore }) {
  const errors = score.items.filter((item) => !item.correct)
  return <section className="score-panel solfege-score">
    <h2>Resultado do solfejo</h2>
    <div className="score-head"><div className="overall"><span>Solfejo</span><strong>{Math.round(score.score)}%</strong></div><div><span>Sílabas corretas</span><strong>{score.correct}/{score.total}</strong></div><div><span>Reconhecidas</span><strong>{score.recognized}</strong></div></div>
    <p><strong>Transcrição:</strong> {score.transcript || 'Nenhuma sílaba reconhecida.'}</p>
    {errors.length > 0 && <div className="solfege-errors"><h3>Pontos a revisar</h3><ul>{errors.map((item) => <li key={item.noteId}>Nota {item.noteId}: esperado <strong>{item.expected}</strong>, {item.recognized ? <>reconhecido <strong>{item.recognized}</strong></> : 'não reconhecida'}</li>)}</ul></div>}
  </section>
}
