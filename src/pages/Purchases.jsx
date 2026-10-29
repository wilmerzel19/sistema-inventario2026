import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { PackagePlus, Plus, ShoppingCart, Truck, X } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { money } from '../utils/format'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const newLine = () => ({ productId: '', name: '', qty: 1, unitCost: 0 })
const today = () => new Date().toISOString().slice(0, 10)
const blank = () => ({ supplier: '', reference: '', date: today(), paymentMethod: 'Efectivo', notes: '', lines: [newLine()] })

export default function Purchases() {
  const { user, store } = useAuth()
  const [products, setProducts] = useState([])
  const [purchases, setPurchases] = useState([])
  const [form, setForm] = useState(blank())
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    const a = onSnapshot(collection(db, 'stores', user.uid, 'products'), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))))
    const b = onSnapshot(collection(db, 'stores', user.uid, 'purchases'), s => setPurchases(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((x,y) => String(y.createdAtText || y.date).localeCompare(String(x.createdAtText || x.date)))))
    return () => { a(); b() }
  }, [user])

  const total = useMemo(() => form.lines.reduce((sum, l) => sum + Number(l.qty || 0) * Number(l.unitCost || 0), 0), [form.lines])
  const monthKey = new Date().toISOString().slice(0, 7)
  const monthPurchases = purchases.filter(p => String(p.date || p.createdAtText || '').slice(0, 7) === monthKey)
  const monthTotal = monthPurchases.reduce((a,p) => a + Number(p.total || 0), 0)
  const monthUnits = monthPurchases.reduce((a,p) => a + (p.lines || []).reduce((s,l) => s + Number(l.qty || 0), 0), 0)

  function setLine(index, patch) {
    const lines = [...form.lines]
    lines[index] = { ...lines[index], ...patch }
    setForm({ ...form, lines })
  }

  function selectProduct(index, id) {
    const p = products.find(x => x.id === id)
    setLine(index, p ? { productId: p.id, name: p.name, unitCost: Number(p.cost || 0) } : { productId: '', name: '', unitCost: 0 })
  }

  async function save(e) {
    e.preventDefault(); setSaving(true)
    try {
      const lines = form.lines.filter(l => l.productId && Number(l.qty) > 0).map(l => ({ ...l, qty: Number(l.qty), unitCost: Number(l.unitCost || 0) }))
      if (!lines.length) throw new Error('Agrega al menos un producto a la compra.')
      const purchaseRef = doc(collection(db, 'stores', user.uid, 'purchases'))
      const grouped = [...lines.reduce((map, line) => {
        const current = map.get(line.productId) || { ...line, qty:0 }
        current.qty += Number(line.qty || 0)
        current.unitCost = Number(line.unitCost || current.unitCost || 0)
        current.name = line.name || current.name
        map.set(line.productId, current)
        return map
      }, new Map()).values()]
      const productRefs = grouped.map(l => doc(db, 'stores', user.uid, 'products', l.productId))
      const movementRefs = grouped.map(() => doc(collection(db, 'stores', user.uid, 'inventoryMovements')))
      const number = `COM-${Date.now().toString().slice(-8)}`
      const createdAtText = new Date().toISOString()
      await runTransaction(db, async tx => {
        const snaps = await Promise.all(productRefs.map(r => tx.get(r)))
        snaps.forEach((snap, i) => {
          if (!snap.exists()) throw new Error(`El producto ${grouped[i].name} ya no existe.`)
        })
        tx.set(purchaseRef, {
          number, supplier: form.supplier.trim(), reference: form.reference.trim(), date: form.date,
          paymentMethod: form.paymentMethod, notes: form.notes.trim(), lines, total,
          createdAt: serverTimestamp(), createdAtText,
        })
        snaps.forEach((snap, i) => {
          const current = Number(snap.data()?.stock || 0)
          const line = grouped[i]
          const after = current + Number(line.qty || 0)
          tx.update(productRefs[i], { stock: after, cost: line.unitCost, updatedAt: serverTimestamp() })
          tx.set(movementRefs[i], {
            productId:line.productId, productName:snap.data()?.name || line.name, sku:snap.data()?.sku || '', type:'entry', source:'purchase',
            reason:'Compra de mercancía', reference:form.reference.trim() || number, notes:form.supplier.trim() ? `Proveedor: ${form.supplier.trim()}` : '',
            quantity:Number(line.qty || 0), balanceBefore:current, balanceAfter:after, unitCost:Number(line.unitCost || 0),
            date:form.date, createdAt:serverTimestamp(), createdAtText,
          })
        })
      })
      setForm(blank()); setOpen(false)
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  return <>
    <PageHeader title="Compras" subtitle="Registra entradas de mercancía y aumenta el stock automáticamente.">
      <button className="btn primary" onClick={() => setOpen(true)}><PackagePlus size={17}/> Nueva compra</button>
    </PageHeader>

    <div className="finance-stats-grid">
      <article className="card finance-stat purple"><span><ShoppingCart/></span><div><small>Compras este mes</small><strong>{money(monthTotal, store?.currency)}</strong><em>{monthPurchases.length} registros</em></div></article>
      <article className="card finance-stat blue"><span><PackagePlus/></span><div><small>Unidades ingresadas</small><strong>{monthUnits}</strong><em>Durante el mes actual</em></div></article>
      <article className="card finance-stat green"><span><Truck/></span><div><small>Promedio por compra</small><strong>{money(monthPurchases.length ? monthTotal / monthPurchases.length : 0, store?.currency)}</strong><em>Ticket de abastecimiento</em></div></article>
    </div>

    <div className="card table-card">{purchases.length ? <div className="table-wrap"><table><thead><tr><th>Número</th><th>Fecha</th><th>Proveedor</th><th>Referencia</th><th>Pago</th><th>Total</th></tr></thead><tbody>{purchases.map(p => <tr key={p.id}><td><strong>{p.number}</strong></td><td>{new Date(`${p.date || today()}T12:00:00`).toLocaleDateString('es-NI')}</td><td>{p.supplier || 'Sin proveedor'}</td><td>{p.reference || '—'}</td><td><span className="badge info">{p.paymentMethod || '—'}</span></td><td><strong>{money(p.total, store?.currency)}</strong></td></tr>)}</tbody></table></div> : <EmptyState title="Sin compras" text="Registra una compra para aumentar el inventario y controlar tus egresos." />}</div>

    <Modal open={open} title="Registrar compra" onClose={() => setOpen(false)} wide>
      <form className="form-stack modal-form" onSubmit={save}>
        <div className="form-grid">
          <label>Proveedor<input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Nombre del proveedor"/></label>
          <label>Factura / referencia<input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="FAC-001"/></label>
          <label>Fecha<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/></label>
          <label>Método de pago<select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Crédito</option><option>Otro</option></select></label>
        </div>
        <div className="document-lines purchase-lines">
          <div className="line purchase-line line-head"><span>Producto</span><span>Cantidad</span><span>Costo unitario</span><span>Total</span><span></span></div>
          {form.lines.map((l,i) => <div className="line purchase-line" key={i}><select value={l.productId} onChange={e => selectProduct(i, e.target.value)}><option value="">Seleccionar producto…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} · stock {p.stock || 0}</option>)}</select><input type="number" min="1" step="1" value={l.qty} onChange={e => setLine(i,{qty:e.target.value})}/><input type="number" min="0" step="0.01" value={l.unitCost} onChange={e => setLine(i,{unitCost:e.target.value})}/><strong>{money(Number(l.qty||0)*Number(l.unitCost||0), store?.currency)}</strong><button type="button" className="icon-btn" disabled={form.lines.length===1} onClick={() => setForm({ ...form, lines: form.lines.filter((_,x)=>x!==i) })}><X size={16}/></button></div>)}
        </div>
        <button type="button" className="btn ghost self-start" onClick={() => setForm({ ...form, lines:[...form.lines,newLine()] })}><Plus size={16}/> Agregar producto</button>
        <label>Notas<textarea rows="2" value={form.notes} onChange={e => setForm({ ...form, notes:e.target.value })}/></label>
        <div className="purchase-total"><span>Total de la compra</span><strong>{money(total, store?.currency)}</strong></div>
        <div className="form-footer"><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="btn primary" disabled={saving}>{saving ? 'Registrando…' : 'Registrar compra y sumar stock'}</button></div>
      </form>
    </Modal>
  </>
}
