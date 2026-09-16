// CONFIGURACIÓN (BO-040..042): valores de app_settings. Las claves las
// crean las migraciones; aquí solo se cambian valores. Interruptores para
// booleanos y un campo con botón de guardar para números y textos.
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, GlassPanel, Input, Loader, Switch, useToast } from '../../components/ui/index.js'
import { fetchSettings, updateSetting } from '../../backofficeApi.js'
import { useAuth } from '../../auth.jsx'
import { relativeTime } from '../../lib/labels.js'

// Agrupación por prefijo de la clave: "features.x" → Funciones.
const GROUPS = {
  features: 'Funciones',
  jobs: 'Ofertas',
  moderation: 'Moderación',
}

export default function AdminSettings() {
  const { can } = useAuth()
  const toast = useToast()
  const canEdit = can('settings.edit')
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    fetchSettings().then(setSettings).catch((e) => setError(e.message))
  }, [])

  async function save(key, value) {
    setBusy(key)
    try {
      const updated = await updateSetting(key, value)
      setSettings((list) => list.map((s) => (s.key === key ? updated : s)))
      toast.success('Ajuste guardado')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  const grouped = Object.entries(GROUPS)
    .map(([prefix, title]) => [title, (settings || []).filter((s) => s.key.startsWith(`${prefix}.`))])
    .filter(([, items]) => items.length)
  const known = new Set(grouped.flatMap(([, items]) => items.map((s) => s.key)))
  const other = (settings || []).filter((s) => !known.has(s.key))
  if (other.length) grouped.push(['Otros', other])

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">
            {canEdit ? 'Cada cambio se aplica al momento y queda en la auditoría.' : 'Puedes consultarla, pero no cambiarla.'}
          </p>
        </div>
      </div>

      <Alert>{error}</Alert>
      {!settings && !error && <Loader label="Cargando configuración…" />}

      <div className="stack">
        {grouped.map(([title, items]) => (
          <GlassPanel key={title} as="section" aria-label={title}>
            <h2 className="section-title">{title}</h2>
            <ul className="settings-list">
              {items.map((s) => (
                <li key={s.key} className="setting">
                  <div className="setting-text">
                    <p className="setting-name">
                      {s.description}
                      {s.is_public && <Badge>Visible en la web</Badge>}
                    </p>
                    <p className="setting-meta">
                      <code>{s.key}</code>
                      {s.updated_by && ` Cambiado ${relativeTime(s.updated_at).toLowerCase()} por ${s.editor?.name || s.editor?.email || 'alguien del equipo'}.`}
                    </p>
                  </div>
                  <SettingControl setting={s} disabled={!canEdit} busy={busy === s.key} onSave={save} />
                </li>
              ))}
            </ul>
          </GlassPanel>
        ))}
      </div>
    </>
  )
}

function SettingControl({ setting, disabled, busy, onSave }) {
  const { key, value, description } = setting
  const [draft, setDraft] = useState(String(value ?? ''))

  useEffect(() => { setDraft(String(value ?? '')) }, [value])

  if (typeof value === 'boolean') {
    return (
      <Switch
        checked={value}
        label={description}
        disabled={disabled}
        busy={busy}
        onChange={(next) => onSave(key, next)}
      />
    )
  }

  const numeric = typeof value === 'number'
  const parsed = numeric ? Number(draft) : draft
  const valid = numeric ? draft.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 : true
  const changed = String(value ?? '') !== draft

  return (
    <form
      className="setting-edit"
      onSubmit={(e) => { e.preventDefault(); if (valid && changed) onSave(key, parsed) }}
    >
      <Input
        aria-label={description}
        type={numeric ? 'number' : 'text'}
        min={numeric ? 0 : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={disabled}
        error={valid ? undefined : 'Escribe un número positivo.'}
      />
      {!disabled && (
        <Button type="submit" size="sm" variant="secondary" loading={busy} disabled={!valid || !changed}>
          Guardar
        </Button>
      )}
    </form>
  )
}
