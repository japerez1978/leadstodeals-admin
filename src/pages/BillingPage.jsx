import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { CreditCard, ExternalLink, X, Wallet, CheckCircle, XCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

const API_BASE = 'https://intranox-proxy-production.up.railway.app'

// Plans are now fetched dynamically from 'apps' table

export default function BillingPage() {
  const [tenants, setTenants] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkoutModal, setCheckoutModal] = useState(null)
  const [toast, setToast] = useState('')
  const [creating, setCreating] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => { loadData() }, [])

  // Handle Stripe redirect
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setToast('✅ ¡Pago completado! La suscripción se activará en unos segundos.')
      setSearchParams({})
      // Reload after a moment to let the webhook process
      setTimeout(() => loadData(), 3000)
    }
    if (searchParams.get('canceled') === 'true') {
      setToast('⚠️ Pago cancelado')
      setSearchParams({})
    }
  }, [searchParams])

  async function loadData() {
    const [tRes, sRes, aRes] = await Promise.all([
      supabase.from('tenants').select('*').order('id'),
      supabase.from('subscriptions').select('*'),
      supabase.from('apps').select('*').order('name'),
    ])
    setTenants(tRes.data || [])
    setSubscriptions(sRes.data || [])
    setApps(aRes.data || [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 5000) }

  function getTenantSubs(tenantId) {
    return subscriptions.filter(s => s.tenant_id === tenantId)
  }

  function getTenantMRR(tenantId) {
    return getTenantSubs(tenantId)
      .filter(s => s.estado === 'activo')
      .reduce((sum, s) => sum + (parseFloat(s.precio_mes) || 0), 0)
  }

  async function handleStripeCheckout(tenant, plan) {
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id, app_slug: plan.slug }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        showToast('❌ Error: ' + (data.error || 'No se pudo crear la sesión'))
        setCreating(false)
      }
    } catch (err) {
      showToast('❌ Error de conexión con Railway: ' + err.message)
      setCreating(false)
    }
  }

  async function handleManualSubscription(tenant, plan) {
    setCreating(true)
    const { error } = await supabase.from('subscriptions').insert({
      tenant_id: tenant.id,
      app_slug: plan.slug,
      estado: 'activo',
      precio_mes: plan.price,
      inicio: new Date().toISOString().slice(0, 10),
    })
    if (error) showToast('❌ Error: ' + error.message)
    else showToast(`✅ Suscripción manual creada para ${tenant.nombre}`)
    setCreating(false)
    setCheckoutModal(null)
    loadData()
  }

  async function cancelSubscription(sub) {
    if (!confirm('¿Cancelar esta suscripción?')) return

    if (sub.stripe_subscription_id) {
      // Cancel in Stripe — webhook will update DB
      try {
        const res = await fetch(`${API_BASE}/api/cancel-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stripe_subscription_id: sub.stripe_subscription_id }),
        })
        if (res.ok) {
          showToast('✅ Suscripción cancelada en Stripe')
          setTimeout(() => loadData(), 2000)
        }
      } catch (err) {
        showToast('❌ Error cancelando en Stripe')
      }
    } else {
      // Manual cancel
      const { error } = await supabase
        .from('subscriptions')
        .update({ estado: 'cancelado' })
        .eq('id', sub.id)
      if (error) showToast('❌ ' + error.message)
      else { showToast('✅ Suscripción cancelada'); loadData() }
    }
  }

  async function openCustomerPortal(tenant) {
    if (!tenant.stripe_customer_id) {
      showToast('⚠️ Esta empresa no tiene cuenta Stripe')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/customer-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id }),
      })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
      else showToast('❌ ' + data.error)
    } catch (err) {
      showToast('❌ Error: ' + err.message)
      showToast('❌ Error de conexión con el servidor')
    }
  }

  const totalMRR = subscriptions
    .filter(s => s.estado === 'activo')
    .reduce((sum, s) => sum + (parseFloat(s.precio_mes) || 0), 0)
  const totalARR = totalMRR * 12

  if (loading) return <div className="empty-state"><div className="empty-state-icon">⏳</div><p>Cargando...</p></div>

  return (
    <>
      <div className="page-header">
        <h1>Facturación</h1>
        <p>Gestiona las suscripciones y cobros con Stripe</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">💰 MRR Total</div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>
            {totalMRR}€<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.7 }}>/mes</span>
          </div>
          <div className="stat-card-sub">Ingresos mensuales</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">🚀 ARR Total</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>
            {totalARR}€<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.7 }}>/año</span>
          </div>
          <div className="stat-card-sub">Ingresos anuales</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">📊 Planes activos</div>
          <div className="stat-card-value">{subscriptions.filter(s => s.estado === 'activo').length}</div>
        </div>
      </div>

      {/* Per-Tenant Billing */}
      {tenants.map(t => {
        const subs = getTenantSubs(t.id)
        const mrr = getTenantMRR(t.id)
        return (
          <div key={t.id} className="table-container" style={{ marginBottom: 20 }}>
            <div className="table-header">
              <div>
                <h3>{t.nombre}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  MRR: <strong style={{ color: 'var(--success)' }}>{mrr}€</strong>
                  {t.stripe_customer_id && (
                    <> · <a href={`https://dashboard.stripe.com/test/customers/${t.stripe_customer_id}`} target="_blank" rel="noopener" style={{ color: 'var(--accent-hover)', textDecoration: 'none' }}>
                      Stripe <ExternalLink size={10} style={{ display: 'inline' }} />
                    </a></>
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {t.stripe_customer_id && (
                  <button className="btn btn-ghost btn-sm" onClick={() => openCustomerPortal(t)} title="Portal Stripe">
                    <Wallet size={14} /> Portal
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={() => setCheckoutModal({ tenant: t })}>
                  <CreditCard size={14} /> Añadir plan
                </button>
              </div>
            </div>
            {subs.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Sin suscripciones activas
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>App</th>
                    <th>Estado</th>
                    <th>Precio</th>
                    <th>Inicio</th>
                    <th>Stripe ID</th>
                    <th style={{ width: 100 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, opacity: 0.6 }}>
                            {apps.find(a => a.slug === s.app_slug)?.icon || 'star'}
                          </span>
                          {apps.find(a => a.slug === s.app_slug)?.name || s.app_slug}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${s.estado === 'activo' ? 'badge-success' : s.estado === 'cancelado' ? 'badge-danger' : s.estado === 'impago' ? 'badge-warning' : 'badge-info'}`}>
                          {s.estado === 'activo' && <><CheckCircle size={10} /> </>}
                          {s.estado === 'cancelado' && <><XCircle size={10} /> </>}
                          {s.estado}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.precio_mes}€/mes</td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.inicio || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {s.stripe_subscription_id
                          ? <a href={`https://dashboard.stripe.com/test/subscriptions/${s.stripe_subscription_id}`} target="_blank" style={{ color: 'var(--accent-hover)', textDecoration: 'none' }}>
                              {s.stripe_subscription_id.slice(0, 20)}…
                            </a>
                          : <span style={{ opacity: 0.5 }}>manual</span>
                        }
                      </td>
                      <td>
                        {s.estado === 'activo' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => cancelSubscription(s)} style={{ color: 'var(--danger)' }}>
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {/* Plan Selection Modal */}
      {checkoutModal && (
        <div className="modal-overlay" onClick={() => setCheckoutModal(null)}>
          <div className="modal" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Añadir plan a {checkoutModal.tenant.nombre}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setCheckoutModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="pricing-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                {apps.map(plan => {
                  const alreadyHas = subscriptions.some(s => s.tenant_id === checkoutModal.tenant.id && s.app_slug === plan.slug && s.estado === 'activo')
                  return (
                    <div key={plan.slug} className="pricing-card" style={alreadyHas ? { opacity: 0.5 } : {}}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>
                         <span className="material-symbols-outlined" style={{ fontSize: 40 }}>{plan.icon}</span>
                      </div>
                      <div className="pricing-card-name">{plan.name}</div>
                      <div className="pricing-card-price">{plan.price}€<span>/mes</span></div>
                      <ul className="pricing-card-features">
                        <li>Acceso completo a {plan.name}</li>
                        <li>Usuarios ilimitados</li>
                        <li>Soporte incluido</li>
                      </ul>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button
                          className={`btn ${alreadyHas ? 'btn-ghost' : 'btn-primary'}`}
                          style={{ width: '100%', justifyContent: 'center' }}
                          disabled={alreadyHas || creating}
                          onClick={() => handleStripeCheckout(checkoutModal.tenant, plan)}
                        >
                          {alreadyHas ? 'Ya contratado' : creating ? 'Procesando...' : '💳 Pagar con Stripe'}
                        </button>
                        {!alreadyHas && (
                          <button
                            className="btn btn-ghost"
                            style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                            disabled={creating}
                            onClick={() => handleManualSubscription(checkoutModal.tenant, plan)}
                          >
                            Activar sin cobrar (manual)
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
