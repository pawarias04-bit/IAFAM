// CATÁLOGOS: áreas, tecnologías, ubicaciones y fuentes. Editar exige
// catalog.edit; sin él, la pantalla es de solo lectura.
import { useEffect, useState } from 'react'
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import {
  Alert, Badge, Button, ConfirmDialog, EmptyState, GlassPanel, Input, Loader, Modal, Select,
  Tabs, useToast,
} from '../../components/ui/index.js'
import { deleteCatalogItem, listCatalog, saveCatalogItem } from '../../backofficeApi.js'
import { useAuth } from '../../auth.jsx'
import { SOURCE_TYPE_LABEL, toOptions } from '../../lib/labels.js'

const TABS = [
  { value: 'categories', label: 'Áreas', singular: 'área' },
  { value: 'skills', label: 'Tecnologías', singular: 'tecnología' },
  { value: 'locations', label: 'Ubicaciones', singular: 'ubicación' },
  { value: 'sources', label: 'Fuentes', singular: 'fuente' },
]

// Qué se muestra en la lista y qué campos tiene el formulario de cada catálogo.
const CONFIG = {
  categories: {
    columns: [{ key: 'name', label: 'Nombre' }, { key: 'slug', label: 'Identificador' }],
    empty: { name: '', slug: '' },
    deleteWarning: 'Las ofertas de esta área quedarán sin área.',
  },
  skills: {
    columns: [{ key: 'name', label: 'Nombre' }, { key: 'category_id', label: 'Área' }],
    empty: { name: '', slug: '', category_id: '' },
    deleteWarning: 'Se quitará de todas las ofertas y perfiles que la tengan.',
  },
  locations: {
    columns: [{ key: 'city', label: 'Ciudad' }, { key: 'region', label: 'Región' }, { key: 'country', label: 'País' }],
    empty: { city: '', region: '', country: '' },
    deleteWarning: 'Las ofertas y empresas con esta ubicación quedarán sin ubicación.',
  },
  sources: {
    columns: [{ key: 'name', label: 'Nombre' }, { key: 'type', label: 'Tipo' }, { key: 'is_active', label: 'Estado' }],
    empty: { name: '', type: 'MANUAL', url: '', is_active: true },
    deleteWarning: 'Se perderá el vínculo con las ofertas que vinieron de esta fuente.',
  },
}

export default function AdminCatalogs() {
  const { can } = useAuth()
  const toast = useToast()
  const canEdit = can('catalog.edit')
  const [tab, setTab] = useState('categories')
  const [items, setItems] = useState(null)
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // { id?, values }
  const [toDelete, setToDelete] = useState(null)

  const current = TABS.find((t) => t.value === tab)
  const config = CONFIG[tab]

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError('')
    listCatalog(tab)
      .then((rows) => { if (!cancelled) setItems(rows) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [tab])

  // Las tecnologías muestran y eligen su área.
  useEffect(() => {
    listCatalog('categories').then(setCategories).catch(() => {})
  }, [])

  function cellValue(item, key) {
    if (key === 'category_id') return categories.find((c) => c.id === item.category_id)?.name || '—'
    if (key === 'type') return SOURCE_TYPE_LABEL[item.type] || item.type
    if (key === 'is_active') return item.is_active ? 'Activa' : <Badge tone="coral">Inactiva</Badge>
    return item[key] || '—'
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Catálogos</h1>
          <p className="page-subtitle">Las opciones que se eligen al publicar y filtrar ofertas.</p>
        </div>
        {canEdit && (
          <Button icon={Plus} onClick={() => setEditing({ values: { ...config.empty } })}>
            Añadir {current.singular}
          </Button>
        )}
      </div>

      <Tabs label="Catálogos" tabs={TABS} value={tab} onChange={setTab} />

      <Alert>{error}</Alert>

      <GlassPanel flush>
        {!items && !error && <Loader label="Cargando…" />}
        {items?.length === 0 && (
          <EmptyState icon={Tags} title={`No hay ${current.label.toLowerCase()} todavía`} />
        )}
        {items?.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  {config.columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}
                  {canEdit && <th scope="col"><span className="visually-hidden">Acciones</span></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    {config.columns.map((c, i) => (
                      <td key={c.key} className={i === 0 ? 'cell-title-plain' : undefined}>{cellValue(item, c.key)}</td>
                    ))}
                    {canEdit && (
                      <td>
                        <div className="cell-actions">
                          <Button
                            variant="ghost" size="sm" icon={Pencil}
                            aria-label={`Editar ${item.name || item.city}`}
                            onClick={() => setEditing({ id: item.id, values: pickValues(tab, item) })}
                          />
                          <Button
                            variant="ghost" size="sm" icon={Trash2} className="btn-danger-quiet"
                            aria-label={`Borrar ${item.name || item.city}`}
                            onClick={() => setToDelete(item)}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      {editing && (
        <CatalogForm
          table={tab}
          singular={current.singular}
          editing={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setItems((list) => {
              const exists = list.some((i) => i.id === saved.id)
              return exists ? list.map((i) => (i.id === saved.id ? saved : i)) : [...list, saved]
            })
            if (tab === 'categories') listCatalog('categories').then(setCategories).catch(() => {})
            toast.success(editing.id ? 'Cambios guardados' : `Añadida: ${saved.name || saved.city}`)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title={`¿Borrar ${toDelete?.name || toDelete?.city || ''}?`}
        description={config.deleteWarning}
        confirmLabel="Borrar"
        onConfirm={async () => {
          await deleteCatalogItem(tab, toDelete.id)
          setItems((list) => list.filter((i) => i.id !== toDelete.id))
          toast.success('Borrado')
        }}
      />
    </>
  )
}

function pickValues(table, item) {
  const values = {}
  for (const key of Object.keys(CONFIG[table].empty)) values[key] = item[key] ?? ''
  return values
}

function CatalogForm({ table, singular, editing, categories, onClose, onSaved }) {
  const [values, setValues] = useState(editing.values)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = await saveCatalogItem(table, editing.id, values)
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing.id ? `Editar ${singular}` : `Añadir ${singular}`}
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="catalog-form" loading={saving}>Guardar</Button>
        </>
      }
    >
      <form id="catalog-form" className="form-stack" onSubmit={submit}>
        <Alert>{error}</Alert>

        {'name' in values && (
          <Input label="Nombre" value={values.name} onChange={(e) => set('name', e.target.value)} required data-autofocus />
        )}
        {'slug' in values && (
          <Input
            label="Identificador"
            hint="Se usa en direcciones web. Si lo dejas vacío se genera a partir del nombre."
            value={values.slug}
            onChange={(e) => set('slug', e.target.value)}
          />
        )}
        {'category_id' in values && (
          <Select
            label="Área"
            placeholder="Sin área"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={values.category_id}
            onChange={(e) => set('category_id', e.target.value)}
          />
        )}
        {'city' in values && (
          <div className="form-grid">
            <Input label="Ciudad" value={values.city} onChange={(e) => set('city', e.target.value)} data-autofocus />
            <Input label="Región" value={values.region} onChange={(e) => set('region', e.target.value)} />
            <Input label="País" value={values.country} onChange={(e) => set('country', e.target.value)} className="span-2" />
          </div>
        )}
        {'type' in values && (
          <Select
            label="Tipo"
            options={toOptions(SOURCE_TYPE_LABEL)}
            value={values.type}
            onChange={(e) => set('type', e.target.value)}
          />
        )}
        {'url' in values && (
          <Input label="URL" type="url" placeholder="https://" value={values.url} onChange={(e) => set('url', e.target.value)} />
        )}
        {'is_active' in values && (
          <Select
            label="Estado"
            options={[{ value: 'true', label: 'Activa' }, { value: 'false', label: 'Inactiva' }]}
            value={String(values.is_active)}
            onChange={(e) => set('is_active', e.target.value === 'true')}
          />
        )}
      </form>
    </Modal>
  )
}
