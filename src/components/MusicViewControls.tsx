import type { MusicView, NoteNaming } from '../types/music'
import type { ClefPreference } from '../music/notationUtils'

interface Props { view: MusicView; naming: NoteNaming; clef: ClefPreference; bpm: number; hasLyrics: boolean; disabled: boolean; onViewChange: (view: MusicView) => void; onNamingChange: (naming: NoteNaming) => void; onClefChange: (clef: ClefPreference) => void; onBpmChange: (bpm: number) => void; onAddNote: () => void }

export function MusicViewControls({ view, naming, clef, bpm, hasLyrics, disabled, onViewChange, onNamingChange, onClefChange, onBpmChange, onAddNote }: Props) {
  const toggleNaming = (next: Exclude<NoteNaming, 'hidden'>) => onNamingChange(naming === next ? 'hidden' : next)
  return <div className="music-view-controls">
    <fieldset><legend>Visualização</legend><button className={view === 'timeline' ? 'selected' : ''} onClick={() => onViewChange('timeline')}>Timeline</button><button className={view === 'score' ? 'selected' : ''} onClick={() => onViewChange('score')}>Partitura</button></fieldset>
    <fieldset><legend>Rótulos das notas</legend><button className={naming === 'letter' ? 'selected' : ''} aria-pressed={naming === 'letter'} onClick={() => toggleNaming('letter')}>C, D, E</button><button className={naming === 'solfege' ? 'selected' : ''} aria-pressed={naming === 'solfege'} onClick={() => toggleNaming('solfege')}>Dó, Ré, Mi</button><button className={naming === 'lyrics' ? 'selected' : ''} aria-pressed={naming === 'lyrics'} disabled={!hasLyrics} title={hasLyrics ? undefined : 'Este MIDI não contém letra'} onClick={() => toggleNaming('lyrics')}>Letra</button></fieldset>
    <label className="bpm-control">BPM<input type="number" min="20" max="300" step="1" value={Math.round(bpm)} disabled={disabled} onChange={(event) => { const value = Number(event.target.value); if (value >= 20 && value <= 300) onBpmChange(value) }} /></label>
    {view === 'score' && <label className="clef-control">Clave<select value={clef} onChange={(event) => onClefChange(event.target.value as ClefPreference)}><option value="auto">Automática</option><option value="treble">Sol</option><option value="treble8vb">Sol 8vb</option><option value="bass">Fá</option></select></label>}
    <button onClick={onAddNote} disabled={disabled}>+ Adicionar nota</button>
  </div>
}
