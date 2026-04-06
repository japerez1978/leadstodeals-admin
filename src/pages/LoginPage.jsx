import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else navigate('/dashboard')
    setLoading(false)
  }

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="login-brand">
          <div className="login-brand-icon">L2D</div>
          <h1>LeadsToDeals</h1>
          <p>Panel de Administración</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@email.com" required />
        </div>
        <div className="form-group">
          <label className="form-label">Contraseña</label>
          <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12, marginTop: 8 }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
