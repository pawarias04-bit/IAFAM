// Notas internas del equipo sobre una ficha (BO-070..072). No las ve nunca
// el usuario ni la empresa. Cada quien borra las suyas; el admin, cualquiera.
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Alert, Button, Loader, Textarea, useToast } from '../ui/index.js'
import { addNote, deleteNote, fetchNotes } from '../../backofficeApi.js'
import { useAuth } from '../../auth.jsx'
import { formatDateTime, relativeTime } from '../../lib/labels.js'

export default function Notes({ entity, entityId }) {
  const { user } = useAuth()
  const toast = useToast()
  const [notes, setNotes] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchNotes(entity, entityId).then(setNotes).catch((e) => setError(e.message))
  }, [entity, entityId])

  async function submit(e) {
    e.preventDefault()
    if (!draft.trim()) return
    setSaving(true)
    setError('')
    try {
      const note = await addNote(entity, entityId, draft)
      setNotes((list) => [note, ...(list || [])])
      setDraft('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(note) {
    try {
      await deleteNote(note.id)
      setNotes((list) => list.filter((n) => n.id !== note.id))
      toast.success('Nota borrada')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="notes">
      <form onSubmit={submit} className="form-stack">
        <Alert>{error}</Alert>
        <Textarea
          label="Nueva nota"
          hint="Solo la ve el equipo."
          placeholder="Llamé a RRHH para confirmar la vacante…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          style={{ minHeight: 80 }}
        />
        <div>
          <Button type="submit" variant="secondary" size="sm" loading={saving} disabled={!draft.trim()}>
            Añadir nota
          </Button>
        </div>
      </form>

      {!notes && !error && <Loader inline label="Cargando notas…" />}
      {notes?.length === 0 && <p className="muted-text">Todavía no hay notas.</p>}
      {notes?.length > 0 && (
        <ul className="note-list">
          {notes.map((note) => (
            <li key={note.id} className="note">
              <div className="note-head">
                <strong>{note.author?.name || note.author?.email || 'Autor eliminado'}</strong>
                <time dateTime={note.created_at} title={formatDateTime(note.created_at)}>
                  {relativeTime(note.created_at)}
                </time>
                {(note.author_id === user?.id || user?.role === 'ADMIN') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="btn-danger-quiet note-delete"
                    aria-label="Borrar nota"
                    onClick={() => remove(note)}
                  />
                )}
              </div>
              <p className="note-body">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
