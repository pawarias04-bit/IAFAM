// Diálogo para decisiones que quedan en la auditoría con su motivo:
// rechazar una oferta, suspender a alguien, resolver un reporte…
//
// `children` permite añadir campos propios de la decisión encima del
// motivo (por ejemplo, qué hacer con la oferta al resolver un reporte).
// `onConfirm(reason)` puede ser async; si falla, el error se muestra dentro.
import { useState } from 'react'
import Button from './Button.jsx'
import Modal from './Modal.jsx'
import { Textarea } from './Field.jsx'
import { Alert } from './Feedback.jsx'

export default function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  reasonLabel = 'Motivo',
  reasonHint = 'Queda guardado en la auditoría.',
  reasonRequired = true,
  placeholder,
  confirmLabel = 'Confirmar',
  tone = 'primary',
  children,
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function close() {
    if (busy) return
    setReason('')
    setError('')
    onClose()
  }

  async function submit(e) {
    e.preventDefault()
    if (reasonRequired && !reason.trim()) {
      setError('Escribe el motivo antes de continuar.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onConfirm(reason.trim())
      setReason('')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={description}
      dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>Cancelar</Button>
          <Button type="submit" form="reason-dialog-form" variant={tone} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="reason-dialog-form" className="form-stack" onSubmit={submit}>
        <Alert>{error}</Alert>
        {children}
        <Textarea
          label={reasonLabel}
          hint={reasonHint}
          placeholder={placeholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required={reasonRequired}
          maxLength={500}
          style={{ minHeight: 96 }}
          data-autofocus
        />
      </form>
    </Modal>
  )
}
