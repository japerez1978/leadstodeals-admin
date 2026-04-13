import { useState, useEffect } from 'react'
import { supabase } from 'core-saas'
import { Plus, Trash2, X, AppWindow, Tag, Euro } from 'lucide-react'

export default function AppsPage() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', slug: '', icon: 'star', price: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadApps() }, [])

  async function loadApps() {
    const { data, error } = await supabase.from('apps').select('*').order('name')
    if (error) showToast('❌ Error: ' + error.message)
    else setApps(data || [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function handleSave() {
    if (!form.name || !form.slug) return
    setSaving(true)
    
    const isEdit = !!form.id
    const action = isEdit 
      ? supabase.from('apps').update(form).eq('id', form.id)
      : supabase.from('apps').insert([form])
    
    const { error } = await action
    if (error) showToast('❌ ' + error.message)
    else {
      showToast(isEdit ? '✅ App actualizada' : '✅ App creada')
      setModal(null)
      loadApps()
    }
    setSaving(false)
  }

  async function handleDelete(id, name) {
    if (!confirm(`¿Eliminar ${name}? Esto afectará a los accesos de usuarios.`)) return
    const { error } = await supabase.from('apps').delete().eq('id', id)
    if (error) showToast('❌ ' + error.message)
    else { showToast('✅ App eliminada'); loadApps() }
  }

  if (loading) return <div className="empty-state"><div className="empty-state-icon">⏳</div><p>Cargando catálogo...</p></div>

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Catálogo de Apps</h1>
          <p>Gestiona los productos disponibles en el ecosistema LeadsToDeals</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', slug: '', icon: 'star', price: '' }); setModal('new') }}>
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {apps.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">📦</div>
            <h3>No hay productos</h3>
            <p>Crea tu primer producto para empezar a venderlo.</p>
          </div>
        ) : apps.map(app => (
          <div key={app.id} className="card" style={{ padding: 20, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ 
                width: 54, height: 54, borderRadius: 16, background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--accent)' }}>{app.icon}</span>
              </div>
              <div style={{ overflow: 'hidden' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</h3>
                <code style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>{app.slug}</code>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                <Euro size={14} /> {app.price}€/mes
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { setForm(app); setModal('edit') }}>Editar</button>
              <button className="btn btn-ghost btn-sm" style={{ padding: 8, color: 'var(--danger)' }} onClick={() => handleDelete(app.id, app.name)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'new' ? '➕ Nuevo Producto' : '✏️ Editar Producto'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre del Producto</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: LeadsToDeals Score" />
              </div>
              <div className="form-group">
                <label className="form-label">Identificador (slug único)</label>
                <input className="form-input" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="ej: ltd-scoring" disabled={modal === 'edit'} />
              </div>
              <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                <div className="form-group">
                  <label className="form-label">Icono (Material Symbol)</label>
                  <input className="form-input" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="trending_up" />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio (€/mes)</label>
                  <input className="form-input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="99" />
                </div>
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
