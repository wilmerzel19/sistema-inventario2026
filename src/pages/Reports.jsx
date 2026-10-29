import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { Download, FileSpreadsheet, PackagePlus, PackageSearch, ReceiptText, Users, WalletCards } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { exportCustomers, exportDocuments, exportExpenses, exportProducts, exportPurchases, exportSales } from '../utils/excel'
import { money } from '../utils/format'
import PageHeader from '../components/PageHeader'

export default function Reports() {
  const { user, store } = useAuth()
  const [products, setProducts] = useState([]), [documents, setDocuments] = useState([]), [customers, setCustomers] = useState([]), [sales,setSales]=useState([]), [purchases,setPurchases]=useState([]), [expenses,setExpenses]=useState([])
  useEffect(() => {
    if (!user) return
    const unsubs = [
      onSnapshot(collection(db, 'stores', user.uid, 'products'), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'stores', user.uid, 'documents'), s => setDocuments(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'stores', user.uid, 'customers'), s => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'stores', user.uid, 'sales'), s => setSales(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'stores', user.uid, 'purchases'), s => setPurchases(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'stores', user.uid, 'expenses'), s => setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })))),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [user])
  const metrics = useMemo(() => ({
    inventoryCost: products.reduce((a,p)=>a+Number(p.cost||0)*Number(p.stock||0),0),
    sales: sales.reduce((a,s)=>a+Number(s.total||0),0),
    out: purchases.reduce((a,p)=>a+Number(p.total||0),0)+expenses.reduce((a,e)=>a+Number(e.amount||0),0),
  }),[products,sales,purchases,expenses])
  return <>
    <PageHeader title="Reportes y exportaciones" subtitle="Respalda inventario, ventas, compras, gastos, clientes y documentos en Excel." />
    <div className="stats-grid report-stats"><div className="card stat"><div className="stat-icon"><PackageSearch/></div><div><small>Costo inventario</small><strong>{money(metrics.inventoryCost,store?.currency)}</strong></div></div><div className="card stat"><div className="stat-icon"><ReceiptText/></div><div><small>Ventas registradas</small><strong>{money(metrics.sales,store?.currency)}</strong></div></div><div className="card stat"><div className="stat-icon"><WalletCards/></div><div><small>Egresos registrados</small><strong>{money(metrics.out,store?.currency)}</strong></div></div></div>
    <div className="export-grid">
      <article className="card export-card"><PackageSearch size={28}/><h2>Inventario</h2><p>Productos, precios, costos, stock e imágenes por URL.</p><button className="btn primary" disabled={!products.length} onClick={()=>exportProducts(products)}><Download size={17}/> Exportar inventario</button></article>
      <article className="card export-card"><ReceiptText size={28}/><h2>Ventas</h2><p>Ventas del POS y nuevas facturas registradas como ingresos.</p><button className="btn primary" disabled={!sales.length} onClick={()=>exportSales(sales)}><Download size={17}/> Exportar ventas</button></article>
      <article className="card export-card"><PackagePlus size={28}/><h2>Compras</h2><p>Entradas de mercancía, proveedores, referencias y totales.</p><button className="btn primary" disabled={!purchases.length} onClick={()=>exportPurchases(purchases)}><Download size={17}/> Exportar compras</button></article>
      <article className="card export-card"><WalletCards size={28}/><h2>Gastos</h2><p>Gastos operativos con categoría, fecha, método de pago y notas.</p><button className="btn primary" disabled={!expenses.length} onClick={()=>exportExpenses(expenses)}><Download size={17}/> Exportar gastos</button></article>
      <article className="card export-card"><FileSpreadsheet size={28}/><h2>Facturas y cotizaciones</h2><p>Número, cliente, subtotal, impuesto, total y fecha.</p><button className="btn primary" disabled={!documents.length} onClick={()=>exportDocuments(documents)}><Download size={17}/> Exportar documentos</button></article>
      <article className="card export-card"><Users size={28}/><h2>Clientes</h2><p>Nombre, teléfonos, WhatsApp, correo, dirección y notas.</p><button className="btn primary" disabled={!customers.length} onClick={()=>exportCustomers(customers)}><Download size={17}/> Exportar clientes</button></article>
    </div>
  </>
}
