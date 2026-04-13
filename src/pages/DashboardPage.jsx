import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Building2, Users, CreditCard, ArrowUpRight } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({ tenants: 0, users: 0, activeSubs: 0, mrr: 0 })
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [tenantsRes, usersRes, subsRes] = await Promise.all([
      supabase.from('tenants').select('*'),
      supabase.from('tenant_users').select('*'),
      supabase.from('subscriptions').select('*').eq('estado', 'activo'),
    ])

    const t = tenantsRes.data || []
    const u = usersRes.data || []
    const s = subsRes.data || []

    setTenants(t)
    const mrrTotal = s.reduce((sum, sub) => sum + (parseFloat(sub.precio_mes) || 0), 0)
    
    setStats({
      tenants: t.length,
      users: u.length,
      activeSubs: s.length,
      mrr: mrrTotal,
      arr: mrrTotal * 12
    })
    setLoading(false)
  }

  if (loading) return <div className="empty-state"><div className="empty-state-icon">⏳</div><p>Cargando...</p></div>

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Resumen general de tu plataforma SaaS</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label"><Building2 size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Empresas</div>
          <div className="stat-card-value">{stats.tenants}</div>
          <div className="stat-card-sub">Tenants registrados</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label"><Users size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Usuarios</div>
          <div className="stat-card-value">{stats.users}</div>
          <div className="stat-card-sub">Usuarios activos</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">💰 MRR</div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>
            {stats.mrr}€<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.7 }}>/mes</span>
          </div>
          <div className="stat-card-sub">Ingresos mensuales</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#a78bfa' }}>🚀 ARR</div>
          <div className="stat-card-value" style={{ color: '#a78bfa' }}>
            {stats.arr}€<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.7 }}>/año</span>
          </div>
          <div className="stat-card-sub">Previsión de ingresos anuales</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>Empresas activas</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Subdominio</th>
              <th>Stripe</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.nombre}</td>
                <td><span className="badge badge-accent">{t.subdominio}</span></td>
                <td>{t.stripe_customer_id ? <span className="badge badge-success">Vinculado</span> : <span className="badge badge-warning">Sin vincular</span>}</td>
                <td style={{ color: 'var(--text-muted)' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString('es') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
