import type { MusicView, NoteNaming } from '../types/music'

interface Props { view: MusicView; naming: NoteNaming; disabled: boolean; onViewChange: (view: MusicView) => void; onNamingChange: (naming: NoteNaming) => void; onAddNote: () => void }

export function MusicViewControls({ view, naming, disabled, onViewChange, onNamingChange, onAddNote }: Props) {
  return <div className="music-view-controls">
    <fieldset disabled={disabled}><legend>Visualização</legend><button className={view === 'timeline' ? 'selected' : ''} onClick={() => onViewChange('timeline')}>Timeline</button><button className={view === 'score' ? 'selected' : ''} onClick={() => onViewChange('score')}>Partitura</button></fieldset>
    <fieldset disabled={disabled}><legend>Nomes</legend><button className={naming === 'letter' ? 'selected' : ''} onClick={() => onNamingChange('letter')}>C, D, E</button><button className={naming === 'solfege' ? 'selected' : ''} onClick={() => onNamingChange('solfege')}>Dó, Ré, Mi</button></fieldset>
    <button onClick={onAddNote} disabled={disabled}>+ Adicionar nota</button>
  </div>
}
