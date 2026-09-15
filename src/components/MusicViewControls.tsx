import type { MusicView, NoteNaming, ScoreLayout } from '../types/music'
import { KEY_SIGNATURE_OPTIONS, type ClefPreference, type KeySignaturePreference } from '../music/notationUtils'

interface Props { view: MusicView; scoreLayout: ScoreLayout; naming: NoteNaming; clef: ClefPreference; keySignature: KeySignaturePreference; bpm: number; hasLyrics: boolean; disabled: boolean; onViewChange: (view: MusicView) => void; onScoreLayoutChange: (layout: ScoreLayout) => void; onNamingChange: (naming: NoteNaming) => void; onClefChange: (clef: ClefPreference) => void; onKeySignatureChange: (key: KeySignaturePreference) => void; onBpmChange: (bpm: number) => void; onAddNote: () => void }

export function MusicViewControls({ view, scoreLayout, naming, clef, keySignature, bpm, hasLyrics, disabled, onViewChange, onScoreLayoutChange, onNamingChange, onClefChange, onKeySignatureChange, onBpmChange, onAddNote }: Props) {
  const toggleNaming = (next: Exclude<NoteNaming, 'hidden'>) => onNamingChange(naming === next ? 'hidden' : next)
  return <div className="music-view-controls">
    <fieldset><legend>Visualização</legend><button className={view === 'timeline' ? 'selected' : ''} onClick={() => onViewChange('timeline')}>Timeline</button><button className={view === 'score' ? 'selected' : ''} onClick={() => onViewChange('score')}>Partitura</button></fieldset>
    {view === 'score' && <fieldset><legend>Layout</legend><button className={scoreLayout === 'continuous' ? 'selected' : ''} onClick={() => onScoreLayoutChange('continuous')}>Rolagem</button><button className={scoreLayout === 'systems' ? 'selected' : ''} onClick={() => onScoreLayoutChange('systems')}>Sistemas</button></fieldset>}
    <fieldset><legend>Rótulos das notas</legend><button className={naming === 'letter' ? 'selected' : ''} aria-pressed={naming === 'letter'} onClick={() => toggleNaming('letter')}>C, D, E</button><button className={naming === 'solfege' ? 'selected' : ''} aria-pressed={naming === 'solfege'} onClick={() => toggleNaming('solfege')}>Dó, Ré, Mi</button><button className={naming === 'lyrics' ? 'selected' : ''} aria-pressed={naming === 'lyrics'} disabled={!hasLyrics} title={hasLyrics ? undefined : 'Este MIDI não contém letra'} onClick={() => toggleNaming('lyrics')}>Letra</button></fieldset>
    <label className="bpm-control">BPM<input type="number" min="20" max="300" step="1" value={Math.round(bpm)} disabled={disabled} onChange={(event) => { const value = Number(event.target.value); if (value >= 20 && value <= 300) onBpmChange(value) }} /></label>
    {view === 'score' && <label className="clef-control">Clave<select value={clef} onChange={(event) => onClefChange(event.target.value as ClefPreference)}><option value="auto">Automática</option><option value="treble">Sol</option><option value="treble8vb">Sol 8vb</option><option value="bass">Fá</option></select></label>}
    {view === 'score' && <label className="key-control">Armadura<select value={keySignature} onChange={(event) => onKeySignatureChange(event.target.value as KeySignaturePreference)}><option value="auto">Automática (MIDI)</option><option value="none">Sem armadura</option>{KEY_SIGNATURE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
    <button onClick={onAddNote} disabled={disabled}>+ Adicionar nota</button>
  </div>
}
