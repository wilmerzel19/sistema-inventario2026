import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Boxes, Database, LockKeyhole, Moon, ShieldCheck, Store, Sun, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.39a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.97-4.33 2.97-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.37l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.53l3.35-2.61Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"/></svg>
}

function authMessage(err) {
  const code = err?.code || ''
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Correo o contraseña incorrectos.'
  if (code === 'auth/email-already-in-use') return 'Ese correo ya tiene una cuenta. Inicia sesión en lugar de registrarte.'
  if (code === 'auth/weak-password') return 'La contraseña es demasiado débil. Usa al menos 6 caracteres.'
  if (code === 'auth/popup-closed-by-user') return 'Se cerró la ventana de Google antes de completar el acceso.'
  if (code === 'auth/popup-blocked') return 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio.'
  if (code === 'auth/unauthorized-domain') return 'Este dominio no está autorizado en Firebase Authentication.'
  if (code === 'auth/operation-not-allowed') return 'Este método de acceso todavía no está habilitado en Firebase Authentication.'
  return err?.message || 'No se pudo continuar.'
}

export default function Login() {
  const { user, login, register, loginWithGoogle } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', storeName: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  if (user) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      if (mode === 'login') await login(form.email, form.password)
      else await register(form.email, form.password, form.storeName || 'Mi Tienda')
    } catch (err) {
      setError(authMessage(err))
    } finally { setBusy(false) }
  }

  async function googleAccess() {
    setError(''); setGoogleBusy(true)
    try { await loginWithGoogle() }
    catch (err) { setError(authMessage(err)) }
    finally { setGoogleBusy(false) }
  }

  return (
    <div className="login-page auth-v8-page">
      <button className="login-theme-toggle" onClick={toggleTheme} aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}>{isDark ? <Sun size={19}/> : <Moon size={19}/>}<span>{isDark ? 'Claro' : 'Oscuro'}</span></button>

      <div className="auth-v8-shell">
        <section className="auth-v8-showcase">
          <div className="auth-v8-brand"><span><Boxes size={24}/></span><div><strong>Super Inventario PRO</strong><small>Multiusuario · V9</small></div></div>
          <div className="auth-v8-copy">
            <span className="auth-v8-kicker"><ShieldCheck size={15}/> DATOS AISLADOS POR CUENTA</span>
            <h1>Una cuenta.<br/><em>Una tienda independiente.</em></h1>
            <p>Cada usuario entra a su propio inventario, ventas, compras, gastos y configuración. Las cuentas nuevas comienzan totalmente vacías.</p>
          </div>
          <div className="auth-v8-features">
            <article><span><Users size={19}/></span><div><strong>Muchos usuarios</strong><small>Cada cuenta tiene un UID único.</small></div></article>
            <article><span><Database size={19}/></span><div><strong>Datos separados</strong><small>Ningún negocio ve información de otro.</small></div></article>
            <article><span><LockKeyhole size={19}/></span><div><strong>Reglas protegidas</strong><small>Firestore valida al propietario en cada operación.</small></div></article>
          </div>
        </section>

        <section className="login-panel auth-v8-panel">
          <div className="login-icon"><Store size={30}/></div>
          <h2>{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu tienda'}</h2>
          <p>{mode === 'login' ? 'Accede al espacio privado de tu negocio.' : 'Tu inventario comenzará vacío y listo para configurar.'}</p>

          <div className="segmented">
            <button type="button" className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError('') }}>Entrar</button>
            <button type="button" className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError('') }}>Crear cuenta</button>
          </div>

          <button type="button" className="btn google-auth-btn" onClick={googleAccess} disabled={googleBusy || busy}><GoogleIcon/><span>{googleBusy ? 'Conectando…' : 'Continuar con Google'}</span></button>
          <div className="auth-divider"><span>o usa correo y contraseña</span></div>

          <form onSubmit={submit} className="form-stack">
            {mode === 'register' && <label>Nombre de la tienda<input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} placeholder="Ej. Perfumería Ángel" required /></label>}
            <label>Correo<input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>Contraseña<input type="password" minLength="6" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
            {error && <div className="alert error">{error}</div>}
            <button className="btn primary auth-main-btn" disabled={busy || googleBusy}>{busy ? 'Procesando…' : mode === 'login' ? 'Entrar a mi tienda' : 'Crear mi tienda vacía'}</button>
          </form>

          <div className="auth-v8-note"><ShieldCheck size={15}/><span>Tu sesión decide qué datos se pueden leer. Cambiar de cuenta cambia completamente de tienda.</span></div>
        </section>
      </div>
    </div>
  )
}
