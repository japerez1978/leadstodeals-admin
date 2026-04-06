import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Plus, Edit2, Trash2, X } from 'lucide-react'

export default function TenantsPage() {
  const [tenants, setTenants] = useState([])
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | tenant object
  const [form, setForm] = useState({ nombre: '', subdominio: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [tRes, aRes] = await Promise.all([
      supabase.from('tenants').select('*').order('id'),
      supabase.from('tenant_apps').select('*'),
    ])
    setTenants(tRes.data || [])
    setApps(aRes.data || [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function openNew() {
    setForm({ nombre: '', subdominio: '' })
    setModal('new')
  }

  function openEdit(t) {
    setForm({ nombre: t.nombre, subdominio: t.subdominio || '' })
    setModal(t)
  }

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    if (modal === 'new') {
      const { error } = await supabase.from('tenants').insert({ nombre: form.nombre, subdominio: form.subdominio || form.nombre.toLowerCase().replace(/\s+/g, '-') })
      if (error) showToast('❌ Error: ' + error.message)
      else showToast('✅ Empresa creada')
    } else {
      const { error } = await supabase.from('tenants').update({ nombre: form.nombre, subdominio: form.subdominio }).eq('id', modal.id)
      if (error) showToast('❌ Error: ' + error.message)
      else showToast('✅ Empresa actualizada')
    }
    setSaving(false)
    setModal(null)
    loadData()
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta empresa? Esto eliminará todos sus datos.')) return
    const { error } = await supabase.from('tenants').delete().eq('id', id)
    if (error) showToast('❌ ' + error.message)
    else { showToast('✅ Empresa eliminada'); loadData() }
  }

  const getApps = (tenantId) => apps.filter(a => a.tenant_id === tenantId)

  if (loading) return <div className="empty-state"><div className="empty-state-icon">⏳</div><p>Cargando...</p></div>

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Empresas</h1>
          <p>Gestiona los tenants de tu plataforma</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nueva empresa</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Subdominio</th>
              <th>Apps contratadas</th>
              <th>Stripe</th>
              <th style={{ width: 100 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr><td colSpan="6"><div className="empty-state"><div className="empty-state-icon">🏢</div><h3>Sin empresas</h3><p>Crea tu primera empresa</p></div></td></tr>
            ) : tenants.map(t => (
              <tr key={t.id}>
                <td style={{ color: 'var(--text-muted)' }}>#{t.id}</td>
                <td style={{ fontWeight: 600 }}>{t.nombre}</td>
                <td><span className="badge badge-accent">{t.subdominio}</span></td>
                <td>
                  {getApps(t.id).length === 0
                    ? <span style={{ color: 'var(--text-muted)' }}>—</span>
                    : getApps(t.id).map(a => (
                      <span key={a.app_slug} className={`badge ${a.activa ? 'badge-success' : 'badge-warning'}`} style={{ marginRight: 4 }}>
                        {a.app_slug === 'ofertas_hubspot' ? '📊 Ofertas' : a.app_slug === 'sat_gestion' ? '🔧 SAT' : a.app_slug}
                      </span>
                    ))
                  }
                </td>
                <td>{t.stripe_customer_id ? <span className="badge badge-success">✓</span> : <span className="badge badge-warning">—</span>}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)} title="Editar"><Edit2 size={14} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)} title="Eliminar" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'new' ? '➕ Nueva empresa' : '✏️ Editar empresa'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Saltoki" />
              </div>
              <div className="form-group">
                <label className="form-label">Subdominio (slug)</label>
                <input className="form-input" value={form.subdominio} onChange={e => setForm({ ...form, subdominio: e.target.value })} placeholder="Ej: saltoki" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
