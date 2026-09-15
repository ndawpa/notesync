import type { MusicView, NoteNaming } from '../types/music'
import type { ClefPreference } from '../music/notationUtils'

interface Props { view: MusicView; naming: NoteNaming; clef: ClefPreference; disabled: boolean; onViewChange: (view: MusicView) => void; onNamingChange: (naming: NoteNaming) => void; onClefChange: (clef: ClefPreference) => void; onAddNote: () => void }

export function MusicViewControls({ view, naming, clef, disabled, onViewChange, onNamingChange, onClefChange, onAddNote }: Props) {
  return <div className="music-view-controls">
    <fieldset disabled={disabled}><legend>Visualização</legend><button className={view === 'timeline' ? 'selected' : ''} onClick={() => onViewChange('timeline')}>Timeline</button><button className={view === 'score' ? 'selected' : ''} onClick={() => onViewChange('score')}>Partitura</button></fieldset>
    <fieldset disabled={disabled}><legend>Nomes</legend><button className={naming === 'letter' ? 'selected' : ''} onClick={() => onNamingChange('letter')}>C, D, E</button><button className={naming === 'solfege' ? 'selected' : ''} onClick={() => onNamingChange('solfege')}>Dó, Ré, Mi</button></fieldset>
    {view === 'score' && <label className="clef-control">Clave<select value={clef} disabled={disabled} onChange={(event) => onClefChange(event.target.value as ClefPreference)}><option value="auto">Automática</option><option value="treble">Sol</option><option value="treble8vb">Sol 8vb</option><option value="bass">Fá</option></select></label>}
    <button onClick={onAddNote} disabled={disabled}>+ Adicionar nota</button>
  </div>
}
