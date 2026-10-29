import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { ArrowDownToLine, ArrowUpFromLine, CalendarDays, ClipboardList, Download, PackageCheck, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { exportInventoryMovements } from '../utils/excel'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const today = () => new Date().toISOString().slice(0, 10)
const blank = () => ({ type: 'entry', productId: '', quantity: 1, date: today(), reason: 'Ajuste manual', reference: '', notes: '' })

const sourceLabels = {
  manual: 'Manual', purchase: 'Compra', pos: 'POS', invoice: 'Factura', sale_edit: 'Corrección venta',
  sale_delete: 'Venta eliminada', product_adjustment: 'Ajuste producto', opening: 'Inventario inicial', import: 'Importación'
}

export default function InventoryMovements() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(blank())
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [type, setType] = useState('all')
  const [productId, setProductId] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) return
    const a = onSnapshot(collection(db, 'stores', user.uid, 'products'), snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const b = onSnapshot(collection(db, 'stores', user.uid, 'inventoryMovements'), snap => {
      setMovements(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((x, y) => String(y.createdAtText || y.date || '').localeCompare(String(x.createdAtText || x.date || ''))))
    })
    return () => { a(); b() }
  }, [user])

  const filtered = useMemo(() => movements.filter(m => {
    const date = String(m.date || m.createdAtText || '').slice(0, 10)
    const text = `${m.productName || ''} ${m.sku || ''} ${m.reason || ''} ${m.reference || ''} ${m.notes || ''}`.toLowerCase()
    return (!month || date.slice(0, 7) === month)
      && (type === 'all' || m.type === type)
      && (productId === 'all' || m.productId === productId)
      && (!search || text.includes(search.toLowerCase()))
  }), [movements, month, type, productId, search])

  const entries = filtered.filter(m => m.type === 'entry').reduce((a, m) => a + Number(m.quantity || 0), 0)
  const exits = filtered.filter(m => m.type === 'exit').reduce((a, m) => a + Number(m.quantity || 0), 0)
  const net = entries - exits

  async function saveManual(e) {
    e.preventDefault()
    const quantity = Math.max(0, Number(form.quantity || 0))
    if (!form.productId) return alert('Selecciona un producto.')
    if (!quantity) return alert('La cantidad debe ser mayor que cero.')
    setSaving(true)
    try {
      const productRef = doc(db, 'stores', user.uid, 'products', form.productId)
      const movementRef = doc(collection(db, 'stores', user.uid, 'inventoryMovements'))
      await runTransaction(db, async tx => {
        const snap = await tx.get(productRef)
        if (!snap.exists()) throw new Error('El producto ya no existe.')
        const product = snap.data()
        const before = Number(product.stock || 0)
        const after = form.type === 'entry' ? before + quantity : before - quantity
        if (after < 0) throw new Error(`Stock insuficiente. Disponible: ${before}`)
        tx.update(productRef, { stock: after, updatedAt: serverTimestamp() })
        tx.set(movementRef, {
          productId: form.productId,
          productName: product.name || 'Producto',
          sku: product.sku || '',
          type: form.type,
          source: 'manual',
          reason: form.reason.trim() || 'Ajuste manual',
          reference: form.reference.trim(),
          notes: form.notes.trim(),
          quantity,
          balanceBefore: before,
          balanceAfter: after,
          unitCost: Number(product.cost || 0),
          date: form.date,
          createdAt: serverTimestamp(),
          createdAtText: new Date(`${form.date}T12:00:00`).toISOString(),
        })
      })
      setForm(blank())
      setOpen(false)
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  return <>
    <PageHeader title="Entradas y salidas" subtitle="Kardex del inventario: revisa cada movimiento y registra ajustes manuales con saldo anterior y saldo final.">
      <button className="btn ghost" disabled={!filtered.length} onClick={() => exportInventoryMovements(filtered)}><Download size={17}/> Exportar Excel</button>
      <button className="btn primary" onClick={() => { setForm(blank()); setOpen(true) }}><Plus size={17}/> Nuevo movimiento</button>
    </PageHeader>

    <div className="movement-stats-grid">
      <article className="card movement-stat entry"><span><ArrowDownToLine/></span><div><small>Entradas filtradas</small><strong>{entries} uds.</strong><em>Mercancía que ingresó</em></div></article>
      <article className="card movement-stat exit"><span><ArrowUpFromLine/></span><div><small>Salidas filtradas</small><strong>{exits} uds.</strong><em>Mercancía que salió</em></div></article>
      <article className="card movement-stat net"><span><PackageCheck/></span><div><small>Movimiento neto</small><strong>{net > 0 ? '+' : ''}{net} uds.</strong><em>Entradas menos salidas</em></div></article>
      <article className="card movement-stat count"><span><ClipboardList/></span><div><small>Movimientos</small><strong>{filtered.length}</strong><em>Registros en el filtro</em></div></article>
    </div>

    <section className="card movement-filters">
      <div className="movement-search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto, referencia o motivo…"/></div>
      <label><CalendarDays size={17}/><input type="month" value={month} onChange={e => setMonth(e.target.value)}/></label>
      <label><SlidersHorizontal size={17}/><select value={type} onChange={e => setType(e.target.value)}><option value="all">Todos</option><option value="entry">Entradas</option><option value="exit">Salidas</option></select></label>
      <select value={productId} onChange={e => setProductId(e.target.value)}><option value="all">Todos los productos</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    </section>

    <div className="card table-card">{filtered.length ? <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Origen</th><th>Motivo / referencia</th><th>Cantidad</th><th>Antes</th><th>Después</th></tr></thead><tbody>{filtered.map(m => <tr key={m.id}>
      <td>{new Date(m.createdAtText || `${m.date || today()}T12:00:00`).toLocaleString('es-NI')}</td>
      <td><strong>{m.productName || 'Producto'}</strong><small className="table-subtext">{m.sku || 'Sin SKU'}</small></td>
      <td><span className={`movement-type ${m.type}`}>{m.type === 'entry' ? <ArrowDownToLine size={14}/> : <ArrowUpFromLine size={14}/>} {m.type === 'entry' ? 'Entrada' : 'Salida'}</span></td>
      <td><span className="badge info">{sourceLabels[m.source] || m.source || 'Sistema'}</span></td>
      <td><strong>{m.reason || 'Movimiento de inventario'}</strong><small className="table-subtext">{m.reference || m.notes || '—'}</small></td>
      <td><strong className={m.type === 'entry' ? 'qty-entry' : 'qty-exit'}>{m.type === 'entry' ? '+' : '-'}{Number(m.quantity || 0)}</strong></td>
      <td>{Number(m.balanceBefore || 0)}</td><td><strong>{Number(m.balanceAfter || 0)}</strong></td>
    </tr>)}</tbody></table></div> : <EmptyState title="Sin movimientos" text="No hay entradas o salidas para los filtros seleccionados. Las compras, ventas y ajustes nuevos aparecerán automáticamente aquí."/>}</div>

    <Modal open={open} title="Registrar entrada o salida" onClose={() => !saving && setOpen(false)}>
      <form className="form-stack modal-form" onSubmit={saveManual}>
        <div className="inventory-movement-toggle">
          <button type="button" className={form.type === 'entry' ? 'active entry' : ''} onClick={() => setForm({ ...form, type: 'entry' })}><ArrowDownToLine size={18}/> Entrada</button>
          <button type="button" className={form.type === 'exit' ? 'active exit' : ''} onClick={() => setForm({ ...form, type: 'exit' })}><ArrowUpFromLine size={18}/> Salida</button>
        </div>
        <label>Producto<select required value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })}><option value="">Seleccionar producto…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} · stock {Number(p.stock || 0)}</option>)}</select></label>
        <div className="form-grid">
          <label>Cantidad<input type="number" min="1" step="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}/></label>
          <label>Fecha<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/></label>
          <label>Motivo<select value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}><option>Ajuste manual</option><option>Devolución</option><option>Mercancía dañada</option><option>Pérdida / merma</option><option>Inventario inicial</option><option>Corrección de conteo</option><option>Traslado</option><option>Otro</option></select></label>
          <label>Referencia<input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Ej. AJ-001"/></label>
        </div>
        <label>Notas<textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Detalle opcional del movimiento"/></label>
        <div className="alert info">Este movimiento modifica el stock del producto inmediatamente y queda guardado en el historial.</div>
        <div className="form-footer"><button type="button" className="btn ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</button><button className="btn primary" disabled={saving}>{saving ? 'Guardando…' : 'Registrar movimiento'}</button></div>
      </form>
    </Modal>
  </>
}
