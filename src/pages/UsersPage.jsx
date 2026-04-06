import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Plus, Trash2, X, Shield, AppWindow } from 'lucide-react'

const APP_OPTIONS = [
  { slug: 'ofertas_hubspot', label: '📊 Ofertas HubSpot', price: '99€/mes' },
  { slug: 'sat_gestion', label: '🔧 Gestión SAT', price: '49€/mes' },
]

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [tenants, setTenants] = useState([])
  const [access, setAccess] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [accessModal, setAccessModal] = useState(null) // user object
  const [form, setForm] = useState({ email: '', password: '', tenant_id: '', rol: 'user' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [uRes, tRes, aRes] = await Promise.all([
      supabase.from('tenant_users').select('*').order('id'),
      supabase.from('tenants').select('*').order('id'),
      supabase.from('user_app_access').select('*'),
    ])
    setUsers(uRes.data || [])
    setTenants(tRes.data || [])
    setAccess(aRes.data || [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const tenantName = (id) => tenants.find(t => t.id === id)?.nombre || '—'
  const getUserApps = (uid) => access.filter(a => a.auth_user_id === uid)

  async function handleCreateUser() {
    if (!form.email || !form.password || !form.tenant_id) return
    setSaving(true)

    // Create auth user via Supabase Admin (requires service role - we'll use signUp for now)
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (authErr) {
      showToast('❌ Error auth: ' + authErr.message)
      setSaving(false)
      return
    }

    const uid = authData.user?.id
    if (!uid) {
      showToast('❌ No se pudo obtener el UID')
      setSaving(false)
      return
    }

    // Create tenant_users record
    const { error: tuErr } = await supabase.from('tenant_users').insert({
      auth_user_id: uid,
      tenant_id: parseInt(form.tenant_id),
      email: form.email,
      rol: form.rol,
    })

    if (tuErr) {
      showToast('❌ Error vinculando: ' + tuErr.message)
    } else {
      showToast('✅ Usuario creado y vinculado')
    }

    setSaving(false)
    setModal(null)
    // Re-login as superadmin since signUp changed the session
    loadData()
  }

  async function handleDeleteUser(u) {
    if (!confirm(`¿Eliminar al usuario ${u.email}?`)) return
    // Remove app access
    await supabase.from('user_app_access').delete().eq('auth_user_id', u.auth_user_id)
    // Remove tenant_users
    const { error } = await supabase.from('tenant_users').delete().eq('id', u.id)
    if (error) showToast('❌ ' + error.message)
    else { showToast('✅ Usuario eliminado'); loadData() }
  }

  async function toggleAppAccess(uid, tenantId, appSlug) {
    const existing = access.find(a => a.auth_user_id === uid && a.app_slug === appSlug)
    if (existing) {
      await supabase.from('user_app_access').delete().eq('id', existing.id)
    } else {
      await supabase.from('user_app_access').insert({ auth_user_id: uid, tenant_id: tenantId, app_slug: appSlug })
    }
    // Reload access
    const { data } = await supabase.from('user_app_access').select('*')
    setAccess(data || [])
    showToast('✅ Acceso actualizado')
  }

  if (loading) return <div className="empty-state"><div className="empty-state-icon">⏳</div><p>Cargando...</p></div>

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Usuarios</h1>
          <p>Gestiona usuarios y su acceso a las apps</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ email: '', password: '', tenant_id: '', rol: 'user' }); setModal('new') }}>
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Empresa</th>
              <th>Rol</th>
              <th>Apps con acceso</th>
              <th style={{ width: 120 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan="5"><div className="empty-state"><div className="empty-state-icon">👤</div><h3>Sin usuarios</h3></div></td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.email}</td>
                <td><span className="badge badge-info">{tenantName(u.tenant_id)}</span></td>
                <td>
                  {u.rol === 'superadmin'
                    ? <span className="badge badge-accent"><Shield size={10} /> superadmin</span>
                    : u.rol === 'admin'
                    ? <span className="badge badge-success">admin</span>
                    : <span className="badge badge-info">user</span>
                  }
                </td>
                <td>
                  {getUserApps(u.auth_user_id).length === 0
                    ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sin apps asignadas</span>
                    : getUserApps(u.auth_user_id).map(a => {
                        const app = APP_OPTIONS.find(o => o.slug === a.app_slug)
                        return <span key={a.app_slug} className="badge badge-success" style={{ marginRight: 4 }}>{app?.label || a.app_slug}</span>
                      })
                  }
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAccessModal(u)} title="Gestionar acceso">
                      <AppWindow size={14} />
                    </button>
                    {u.rol !== 'superadmin' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteUser(u)} style={{ color: 'var(--danger)' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New User Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Nuevo usuario</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="usuario@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="form-group">
                <label className="form-label">Empresa</label>
                <select className="form-select" value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })}>
                  <option value="">— Selecciona empresa —</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select className="form-select" value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreateUser} disabled={saving}>{saving ? 'Creando...' : 'Crear usuario'}</button>
            </div>
          </div>
        </div>
      )}

      {/* App Access Modal */}
      {accessModal && (
        <div className="modal-overlay" onClick={() => setAccessModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔐 Acceso a Apps — {accessModal.email}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setAccessModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Empresa: <strong>{tenantName(accessModal.tenant_id)}</strong>
              </p>
              {APP_OPTIONS.map(app => {
                const hasAccess = access.some(a => a.auth_user_id === accessModal.auth_user_id && a.app_slug === app.slug)
                return (
                  <div key={app.slug} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: hasAccess ? 'var(--success-subtle)' : 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)', marginBottom: 8, border: `1px solid ${hasAccess ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{app.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{app.price}</div>
                    </div>
                    <button
                      className={`btn btn-sm ${hasAccess ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => toggleAppAccess(accessModal.auth_user_id, accessModal.tenant_id, app.slug)}
                    >
                      {hasAccess ? 'Quitar acceso' : 'Dar acceso'}
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAccessModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
