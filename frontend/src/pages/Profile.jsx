// PERFIL: datos personales editables y ofertas guardadas.
import { useEffect, useState } from 'react'
import { Bookmark, Search } from 'lucide-react'
import JobCard from '../components/JobCard.jsx'
import {
  Alert, Badge, Button, CompanyMark, EmptyState, GlassPanel, Input, Loader, Select, useToast,
} from '../components/ui/index.js'
import { fetchProfile, updateProfile } from '../api.js'
import { useAuth } from '../auth.jsx'
import { LEVEL_LABEL, MODE_LABEL, ROLE_LABEL, toOptions } from '../lib/labels.js'

const EDITABLE = ['name', 'career', 'university', 'graduation_year', 'experience_level', 'preferred_mode']

export default function Profile() {
  const toast = useToast()
  const { updateUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({})
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProfile()
      .then(({ user, favorites: favs }) => {
        setProfile(user)
        setForm(pickEditable(user))
        setFavorites(favs || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const updated = await updateProfile(form)
      setProfile((prev) => ({ ...prev, ...updated }))
      updateUser({ name: updated.name })
      setForm(pickEditable(updated))
      toast.success('Perfil guardado')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader label="Cargando tu perfil…" />

  const currentYear = new Date().getFullYear()

  return (
    <>
      <GlassPanel className="profile-head">
        <CompanyMark name={profile?.name || profile?.email} size="lg" />
        <div>
          <h1 className="page-title">{profile?.name || 'Tu perfil'}</h1>
          <p className="page-subtitle">{profile?.email}</p>
        </div>
        {profile?.role && profile.role !== 'USER' && (
          <Badge tone="cobalt">{ROLE_LABEL[profile.role]}</Badge>
        )}
      </GlassPanel>

      <div className="profile-grid">
        <GlassPanel as="form" strong onSubmit={handleSave}>
          <div className="panel-head">
            <h2 className="section-title">Tus datos</h2>
          </div>

          <div className="form-stack">
            <Alert>{error}</Alert>
            <Input label="Nombre" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
            <div className="form-grid">
              <Input label="Carrera" value={form.career} onChange={(e) => setField('career', e.target.value)} />
              <Input label="Universidad" value={form.university} onChange={(e) => setField('university', e.target.value)} />
              <Input
                label="Año de graduación"
                type="number"
                inputMode="numeric"
                min="1950"
                max={currentYear + 8}
                value={form.graduation_year}
                onChange={(e) => setField('graduation_year', e.target.value)}
              />
              <Select
                label="Nivel"
                placeholder="Sin indicar"
                options={toOptions(LEVEL_LABEL)}
                value={form.experience_level}
                onChange={(e) => setField('experience_level', e.target.value)}
              />
              <Select
                label="Modalidad que prefieres"
                placeholder="Me da igual"
                options={toOptions(MODE_LABEL)}
                value={form.preferred_mode}
                onChange={(e) => setField('preferred_mode', e.target.value)}
                className="span-2"
              />
            </div>
            <div>
              <Button type="submit" loading={saving}>Guardar perfil</Button>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel flush as="section" aria-labelledby="saved-title">
          <div className="list-head">
            <div>
              <h2 id="saved-title" className="section-title">Ofertas guardadas</h2>
              <p className="list-count">
                {favorites.length === 1 ? '1 oferta' : `${favorites.length} ofertas`}
              </p>
            </div>
          </div>

          {favorites.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Todavía no has guardado ninguna"
              action={<Button to="/" variant="secondary" icon={Search}>Explorar ofertas</Button>}
            >
              Pulsa Guardar en una oferta y aparecerá aquí.
            </EmptyState>
          ) : (
            <ul className="job-list">
              {favorites.map((job) => (
                <li key={job.id}><JobCard job={job} /></li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </>
  )
}

// Solo los campos del formulario, con '' en lugar de null para que los
// inputs sigan siendo controlados.
function pickEditable(user = {}) {
  return Object.fromEntries(EDITABLE.map((k) => [k, user[k] ?? '']))
}
