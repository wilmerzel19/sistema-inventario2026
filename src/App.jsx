import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Customers from './pages/Customers'
import Documents from './pages/Documents'
import Marketing from './pages/Marketing'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import CatalogPublic from './pages/CatalogPublic'
import Purchases from './pages/Purchases'
import POS from './pages/POS'
import Sales from './pages/Sales'
import Expenses from './pages/Expenses'
import Finance from './pages/Finance'
import InventoryMovements from './pages/InventoryMovements'
import Appearance from './pages/Appearance'

function ProtectedApp() {
  const { user, loading } = useAuth()
  if (loading) return <div className="center-page">Cargando sistema…</div>
  if (!user) return <Navigate to="/login" replace />
  return <Layout />
}

export default function App() {
  return (
    <Routes>
      <Route path="/catalogo/:slug" element={<CatalogPublic />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedApp />}>
        <Route index element={<Dashboard />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/ventas" element={<Sales />} />
        <Route path="/compras" element={<Purchases />} />
        <Route path="/gastos" element={<Expenses />} />
        <Route path="/finanzas" element={<Finance />} />
        <Route path="/productos" element={<Products />} />
        <Route path="/movimientos" element={<InventoryMovements />} />
        <Route path="/clientes" element={<Customers />} />
        <Route path="/documentos" element={<Documents />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/reportes" element={<Reports />} />
        <Route path="/apariencia" element={<Appearance />} />
        <Route path="/configuracion" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
