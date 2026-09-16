// EMPRESAS (backoffice): listado con verificación, estado y número de
// ofertas, y alta en un modal. Cada empresa tiene su ficha en
// CompanyDetail.jsx.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, Search } from 'lucide-react'
import {
  Alert, Badge, Button, CompanyMark, EmptyState, GlassPanel, Input, Loader, Modal, Select,
  Textarea, useToast,
} from '../../components/ui/index.js'
import { adminCreateCompany } from '../../api.js'
import { listCompaniesAdmin } from '../../backofficeApi.js'
import { useAuth } from '../../auth.jsx'
import { COMPANY_VERIFICATION_LABEL, formatDate, toOptions } from '../../lib/labels.js'

const EMPTY = { name: '', website: '', logo_url: '', description: '' }

export const COMPANY_VERIFICATION_TONE = {
  UNVERIFIED: 'neutral',
  PENDING: 'amber',
  VERIFIED: 'teal',
  REJECTED: 'coral',
}

export default function AdminCompanies() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const canEdit = can('companies.edit')
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [verification, setVerification] = useState('')

  useEffect(() => {
    listCompaniesAdmin().then(setCompanies).catch((e) => setError(e.message))
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (companies || []).filter((c) =>
      (!q || c.name.toLowerCase().includes(q)) &&
      (!verification || c.verification_status === verification))
  }, [companies, search, verification])

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Empresas</h1>
          <p className="page-subtitle">Cada oferta pertenece a una de estas empresas.</p>
        </div>
        {canEdit && <Button icon={Plus} onClick={() => setModalOpen(true)}>Añadir empresa</Button>}
      </div>

      <GlassPanel className="toolbar">
        <Input
          icon={Search}
          type="search"
          aria-label="Buscar empresas"
          placeholder="Nombre de la empresa"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="toolbar-grow"
        />
        <Select
          aria-label="Verificación"
          placeholder="Cualquier verificación"
          options={toOptions(COMPANY_VERIFICATION_LABEL)}
          value={verification}
          onChange={(e) => setVerification(e.target.value)}
        />
      </GlassPanel>

      <Alert>{error}</Alert>

      <GlassPanel flush>
        {!companies && !error && <Loader label="Cargando empresas…" />}

        {companies?.length === 0 && (
          <EmptyState
            icon={Building2}
            title="No hay empresas todavía"
            action={canEdit && <Button icon={Plus} onClick={() => setModalOpen(true)}>Añadir la primera</Button>}
          >
            Necesitas al menos una para poder publicar ofertas.
          </EmptyState>
        )}

        {companies?.length > 0 && visible.length === 0 && (
          <EmptyState icon={Search} title="Ninguna empresa coincide">
            Cambia la búsqueda o el filtro de verificación.
          </EmptyState>
        )}

        {visible.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col">Verificación</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="cell-num">Ofertas</th>
                  <th scope="col">Añadida</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cell-main">
                        <CompanyMark name={c.name} logoUrl={c.logo_url} size="sm" />
                        <div>
                          <Link to={`/admin/companies/${c.id}`} className="cell-title">{c.name}</Link>
                          {c.website && <p className="cell-sub">{c.website.replace(/^https?:\/\//, '')}</p>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge tone={COMPANY_VERIFICATION_TONE[c.verification_status]}>
                        {COMPANY_VERIFICATION_LABEL[c.verification_status]}
                      </Badge>
                    </td>
                    <td>{c.is_active ? 'Activa' : <Badge tone="coral">Desactivada</Badge>}</td>
                    <td className="cell-num num">{c.job_count}</td>
                    <td className="cell-nowrap">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      <CompanyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(company) => {
          toast.success(`Empresa “${company.name}” creada`)
          navigate(`/admin/companies/${company.id}`)
        }}
      />
    </>
  )
}

function CompanyModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function close() {
    if (saving) return
    setForm(EMPTY)
    setError('')
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const company = await adminCreateCompany(form)
      setForm(EMPTY)
      onClose()
      onCreated(company)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Añadir empresa"
      description="Aparecerá en el formulario de ofertas."
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="company-form" loading={saving}>Añadir empresa</Button>
        </>
      }
    >
      <form id="company-form" className="form-stack" onSubmit={handleSubmit}>
        <Alert>{error}</Alert>
        <Input
          label="Nombre"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          required
          data-autofocus
        />
        <div className="form-grid">
          <Input
            label="Sitio web"
            type="url"
            placeholder="https://"
            value={form.website}
            onChange={(e) => setField('website', e.target.value)}
          />
          <Input
            label="URL del logo"
            type="url"
            placeholder="https://"
            value={form.logo_url}
            onChange={(e) => setField('logo_url', e.target.value)}
          />
        </div>
        <Textarea
          label="Descripción"
          placeholder="A qué se dedica, en una o dos frases."
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          style={{ minHeight: 96 }}
        />
      </form>
    </Modal>
  )
}
