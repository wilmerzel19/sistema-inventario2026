import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight, BarChart3, Boxes, Calculator, FileText, LayoutDashboard, LogOut, Megaphone, Menu, Moon,
  PackagePlus, Palette, PiggyBank, ReceiptText, Settings, ShoppingBag, ShoppingCart, Sparkles, Sun, Users, WalletCards, X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import CalculatorPanel from './CalculatorPanel'

const nav = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/pos', 'POS · Caja', ShoppingCart],
  ['/ventas', 'Ventas', ReceiptText],
  ['/compras', 'Compras', PackagePlus],
  ['/gastos', 'Gastos', WalletCards],
  ['/finanzas', 'Finanzas', PiggyBank],
  ['/productos', 'Inventario', Boxes],
  ['/movimientos', 'Entradas y salidas', ArrowLeftRight],
  ['/clientes', 'Clientes', Users],
  ['/documentos', 'Facturas y cotizaciones', FileText],
  ['/marketing', 'Marketing Studio', Megaphone],
  ['/reportes', 'Reportes', BarChart3],
  ['/apariencia', 'Apariencia', Palette],
  ['/configuracion', 'Configuración', Settings],
]

export default function Layout() {
  const { user, store, logout } = useAuth()
  const { isDark, toggleTheme, design, designs } = useTheme()
  const [open, setOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  const location = useLocation()
  const currentDesign = designs.find(item => item.id === design)
  useEffect(() => setOpen(false), [location.pathname])

  return <div className="app-shell" style={{ '--store-accent': store?.accentColor || '#6366f1' }}>
    <header className="mobile-topbar">
      <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={22}/></button>
      <div className="mobile-brand">{store?.logoUrl ? <img src={store.logoUrl} alt="Logo"/> : <span><ShoppingBag size={18}/></span>}<div><strong>{store?.name || 'Mi Tienda'}</strong><small>Inventario PRO V9</small></div></div>
      <div className="mobile-tools"><button className="mobile-theme-btn" onClick={() => setCalcOpen(true)} aria-label="Abrir calculadora" title="Calculadora"><Calculator size={18}/></button><button className="mobile-theme-btn" onClick={toggleTheme} aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'} title={isDark ? 'Modo claro' : 'Modo oscuro'}>{isDark ? <Sun size={18}/> : <Moon size={18}/>}</button></div>
    </header>
    {open && <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand"><div className="brand-logo-wrap">{store?.logoUrl ? <img src={store.logoUrl} alt="Logo" /> : <div className="brand-mark"><ShoppingBag size={22}/></div>}<span className="brand-status" /></div><div className="brand-copy"><strong>{store?.name || 'Mi Tienda'}</strong><small>Super Inventario PRO V9</small></div><button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
      <div className="sidebar-chip"><Sparkles size={15}/><span>Gestión + POS + Finanzas</span></div>
      <small className="nav-label">MENÚ PRINCIPAL</small>
      <nav>{nav.map(([href,label,Icon])=><NavLink key={href} to={href} end={href==='/' } className={({isActive})=>isActive?'nav-link active':'nav-link'}><span className="nav-icon"><Icon size={18}/></span><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-footer">
        <button className="theme-switch calculator-switch" onClick={() => setCalcOpen(true)}><span className="theme-switch-icon"><Calculator size={18}/></span><span><strong>Calculadora</strong><small>Cálculos rápidos sin salir del panel</small></span></button>
        <NavLink to="/apariencia" className="theme-switch appearance-switch"><span className="theme-switch-icon"><Palette size={18}/></span><span><strong>{currentDesign?.name || 'Diseño'}</strong><small>Cambiar colores y apariencia</small></span></NavLink>
        <button className="theme-switch" onClick={toggleTheme}><span className="theme-switch-icon">{isDark ? <Sun size={18}/> : <Moon size={18}/>}</span><span><strong>{isDark ? 'Modo claro' : 'Modo oscuro'}</strong><small>{isDark ? 'Cambiar a interfaz clara' : 'Cambiar a interfaz oscura'}</small></span></button>
        <div className="account-chip">{user?.photoURL ? <img src={user.photoURL} alt="Usuario" referrerPolicy="no-referrer"/> : <span>{(user?.email || 'U').slice(0,1).toUpperCase()}</span>}<div><strong>{user?.displayName || 'Mi cuenta'}</strong><small>{user?.email || 'Sesión activa'}</small></div></div><div className="sidebar-help"><span className="help-icon"><Sparkles size={18}/></span><div><strong>Espacio privado</strong><small>Datos aislados por tu usuario.</small></div></div>
        <button className="nav-link logout" onClick={logout}><span className="nav-icon"><LogOut size={19}/></span><span>Cerrar sesión</span></button>
      </div>
    </aside>
    <main className="main"><Outlet /></main>
    <CalculatorPanel open={calcOpen} onClose={() => setCalcOpen(false)} />
  </div>
}
