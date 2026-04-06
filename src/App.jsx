import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { Building2, Users, CreditCard, LayoutDashboard, LogOut, Shield } from 'lucide-react'
import DashboardPage from './pages/DashboardPage'
import TenantsPage from './pages/TenantsPage'
import UsersPage from './pages/UsersPage'
import BillingPage from './pages/BillingPage'
import LoginPage from './pages/LoginPage'

function Sidebar({ user, onLogout }) {
  const links = [
    { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/tenants', icon: <Building2 size={18} />, label: 'Empresas' },
    { to: '/users', icon: <Users size={18} />, label: 'Usuarios' },
    { to: '/billing', icon: <CreditCard size={18} />, label: 'Facturación' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">L2D</div>
        <div>
          <div className="sidebar-brand-text">LeadsToDeals</div>
          <div className="sidebar-brand-sub">Panel Admin</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {links.map(l => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            {l.icon}
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, padding: '0 12px' }}>
          <Shield size={12} style={{ display: 'inline', marginRight: 4 }} />
          {user?.email}
        </div>
        <button className="sidebar-link" onClick={onLogout}>
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) checkSuperadmin(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) checkSuperadmin(session.user.id)
      else { setIsSuperadmin(false); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function checkSuperadmin(uid) {
    const { data, error } = await supabase.rpc('get_user_role')
    console.log('Role check:', data, error)
    setIsSuperadmin(data === 'superadmin')
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="login-container">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!isSuperadmin) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ marginBottom: 8 }}>Acceso denegado</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
            Solo los usuarios con rol <strong>superadmin</strong> pueden acceder al panel de administración.
          </p>
          <button className="btn btn-ghost" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="main-content">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tenants" element={<TenantsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}
