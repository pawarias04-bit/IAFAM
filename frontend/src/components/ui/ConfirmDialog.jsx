// Confirmacion para acciones que no se pueden deshacer. Sustituye a
// window.confirm(), que no se puede estilizar ni traducir.
//
// `onConfirm` puede ser async: el boton muestra carga mientras tanto y el
// dialogo solo se cierra si la promesa se resuelve. Si falla, el error se
// muestra dentro del dialogo en vez de perderse.
import { useState } from 'react'
import Button from './Button.jsx'
import Modal from './Modal.jsx'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger', // danger | primary
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function close() {
    if (busy) return
    setError('')
    onClose()
  }

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e.message)
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
      size="sm"
      dismissible={!busy}
      footer={
        <>
          {/* El foco inicial va a Cancelar: un Enter por inercia no borra nada. */}
          <Button variant="ghost" onClick={close} disabled={busy} data-autofocus>{cancelLabel}</Button>
          <Button variant={tone} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && <p className="alert alert-error" role="alert">{error}</p>}
    </Modal>
  )
}
