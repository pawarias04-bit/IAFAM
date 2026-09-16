// PORTAL DE EMPRESAS, entrada (/empresa).
//
// Tres situaciones: no formas parte de ninguna empresa (alta), formas parte
// de una (se abre directamente) o de varias (se elige).
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Building2, Lock } from 'lucide-react'
import {
  Alert, Badge, Button, CompanyMark, EmptyState, GlassPanel, Input, Loader, Textarea,
} from '../../components/ui/index.js'
import { createCompanyAccount, fetchMyCompanies } from '../../companyApi.js'
import { useFeature } from '../../settings.jsx'
import { COMPANY_VERIFICATION_LABEL } from '../../lib/labels.js'
import { COMPANY_VERIFICATION_TONE } from '../admin/AdminCompanies.jsx'

export default function CompanyPortal() {
  const portalOpen = useFeature('company_portal')
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMyCompanies().then(setCompanies).catch((e) => setError(e.message))
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!companies) return <Loader label="Cargando tus empresas…" />

  if (companies.length === 1) {
    return <Navigate to={`/empresa/${companies[0].id}`} replace />
  }

  if (companies.length > 1) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">Tus empresas</h1>
        </div>
        <GlassPanel flush>
          <ul className="simple-list">
            {companies.map((c) => (
              <li key={c.id}>
                <span className="cell-main">
                  <CompanyMark name={c.name} logoUrl={c.logo_url} size="sm" />
                  <Link to={`/empresa/${c.id}`} className="cell-title">{c.name}</Link>
                </span>
                <Badge tone={COMPANY_VERIFICATION_TONE[c.verification_status]}>
                  {COMPANY_VERIFICATION_LABEL[c.verification_status]}
                </Badge>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </>
    )
  }

  if (!portalOpen) {
    return (
      <GlassPanel style={{ marginTop: 40 }}>
        <EmptyState icon={Lock} title="El portal de empresas todavía no está abierto">
          Estamos preparándolo. Si quieres publicar ofertas ahora, escribe al equipo de IAFAM Jobs
          y las damos de alta nosotros.
        </EmptyState>
      </GlassPanel>
    )
  }

  return <CompanyOnboarding />
}

function CompanyOnboarding() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', website: '', description: '', logo_url: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const id = await createCompanyAccount(form)
      navigate(`/empresa/${id}`, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="narrow-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Publica tus ofertas en IAFAM Jobs</h1>
          <p className="page-subtitle">
            Da de alta tu empresa, prepara la oferta y el equipo la revisa antes de publicarla.
          </p>
        </div>
      </div>

      <GlassPanel as="section" className="steps" aria-label="Cómo funciona">
        <ol className="step-list">
          <li><strong>Creas la empresa.</strong> Queda pendiente de verificación.</li>
          <li><strong>Preparas tus ofertas.</strong> Puedes guardarlas como borrador desde el primer momento.</li>
          <li><strong>Las envías a revisión.</strong> El equipo las publica o te dice qué corregir.</li>
        </ol>
      </GlassPanel>

      <GlassPanel as="form" strong onSubmit={submit}>
        <h2 className="section-title">Datos de la empresa</h2>
        <div className="form-stack" style={{ marginTop: 16 }}>
          <Alert>{error}</Alert>
          <Input
            label="Nombre"
            hint="Tal como quieres que aparezca en las ofertas."
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            maxLength={120}
            autoFocus
          />
          <div className="form-grid">
            <Input
              label="Sitio web"
              type="url"
              placeholder="https://"
              hint="Ayuda a verificarte más rápido."
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
            label="A qué se dedica"
            placeholder="Desarrollamos software de gestión para clínicas…"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            style={{ minHeight: 96 }}
          />
          <div>
            <Button type="submit" size="lg" icon={Building2} loading={saving}>
              Crear empresa
            </Button>
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}
