import { useState } from 'react'
import { midiToDisplayName } from '../music/noteUtils'
import type { NoteNaming, ReferenceNote } from '../types/music'

interface Props { note: ReferenceNote; naming: NoteNaming; canDelete: boolean; onSave: (note: ReferenceNote) => void; onDelete: () => void; onClose: () => void }

export function NoteEditor({ note, naming, canDelete, onSave, onDelete, onClose }: Props) {
  const editorNaming = naming === 'hidden' || naming === 'lyrics' ? 'letter' : naming
  const [midi, setMidi] = useState(note.midi)
  const [start, setStart] = useState(note.start)
  const [duration, setDuration] = useState(note.duration)
  const valid = Number.isFinite(midi) && midi >= 0 && midi <= 127 && Number.isFinite(start) && start >= 0 && Number.isFinite(duration) && duration > 0
  return <section className="note-editor" aria-label="Editar nota">
    <div><h2>Editar {midiToDisplayName(midi, editorNaming)}</h2><button className="close" aria-label="Fechar editor" onClick={onClose}>×</button></div>
    <label>Nota MIDI<input type="number" min="0" max="127" step="1" value={midi} onChange={(event) => setMidi(Number(event.target.value))} /><small>{midiToDisplayName(midi, editorNaming)}</small></label>
    <label>Início (segundos)<input type="number" min="0" step="0.01" value={start} onChange={(event) => setStart(Number(event.target.value))} /></label>
    <label>Duração (segundos)<input type="number" min="0.05" step="0.01" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
    <div className="editor-actions"><button className="danger" disabled={!canDelete} title={canDelete ? undefined : 'O exercício precisa manter pelo menos uma nota'} onClick={onDelete}>Excluir</button><button className="primary" disabled={!valid} onClick={() => onSave({ ...note, midi: Math.round(midi), pitch: midiToDisplayName(Math.round(midi), 'letter'), start, duration })}>Salvar alterações</button></div>
  </section>
}
