import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { FilePlus2, Printer, X } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { money } from '../utils/format'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const newLine = () => ({ productId: '', name: '', qty: 1, price: 0, cost: 0 })
const blankForm = { type: 'quote', customerId: '', customerName: '', customerPhone: '', customerEmail: '', customerAddress: '', paymentMethod: 'Efectivo', notes: '', lines: [newLine()] }
const escapeHtml = (v = '') => String(v).replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]))

export default function Documents() {
  const { user, store } = useAuth()
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [documents, setDocuments] = useState([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(blankForm)

  useEffect(() => {
    if (!user) return
    const unsubs = [
      onSnapshot(collection(db, 'stores', user.uid, 'products'), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'stores', user.uid, 'customers'), s => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'stores', user.uid, 'documents'), s => setDocuments(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.number || '').localeCompare(a.number || '')))),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [user])

  const calc = useMemo(() => {
    const subtotal = form.lines.reduce((a, l) => a + Number(l.qty || 0) * Number(l.price || 0), 0)
    const tax = subtotal * (Number(store?.taxRate || 0) / 100)
    return { subtotal, tax, total: subtotal + tax }
  }, [form.lines, store?.taxRate])

  function setLine(index, patch) {
    const lines = [...form.lines]; lines[index] = { ...lines[index], ...patch }; setForm({ ...form, lines })
  }

  function selectProduct(index, id) {
    const p = products.find(x => x.id === id)
    setLine(index, p ? { productId: p.id, name: p.name, price: Number(p.price || 0), cost: Number(p.cost || 0) } : { productId: '', name: '', price: 0, cost: 0 })
  }

  function selectCustomer(id) {
    const c = customers.find(x => x.id === id)
    if (!c) return setForm({ ...form, customerId: '', customerName: '', customerPhone: '', customerEmail: '', customerAddress: '' })
    setForm({ ...form, customerId: c.id, customerName: c.name || '', customerPhone: c.phone || c.whatsapp || '', customerEmail: c.email || '', customerAddress: c.address || '' })
  }

  async function save(e) {
    e.preventDefault(); setSaving(true)
    try {
      const lines = form.lines.filter(l => l.name && Number(l.qty) > 0).map(l => ({ ...l, qty: Number(l.qty), price: Number(l.price) }))
      if (!lines.length) throw new Error('Agrega al menos un producto.')
      const number = `${form.type === 'invoice' ? 'FAC' : 'COT'}-${Date.now().toString().slice(-8)}`
      const documentRef = doc(collection(db, 'stores', user.uid, 'documents'))
      const saleRef = form.type === 'invoice' ? doc(collection(db, 'stores', user.uid, 'sales')) : null
      const productLines = [...lines.filter(l => l.productId).reduce((map, line) => {
        const current = map.get(line.productId) || { ...line, qty:0 }
        current.qty += Number(line.qty || 0)
        current.name = line.name || current.name
        map.set(line.productId, current)
        return map
      }, new Map()).values()]
      const productRefs = productLines.map(l => doc(db, 'stores', user.uid, 'products', l.productId))
      const movementRefs = form.type === 'invoice' ? productLines.map(() => doc(collection(db, 'stores', user.uid, 'inventoryMovements'))) : []
      const createdAtText = new Date().toISOString()
      await runTransaction(db, async tx => {
        const snaps = await Promise.all(productRefs.map(ref => tx.get(ref)))
        if (form.type === 'invoice') {
          for (let i = 0; i < snaps.length; i++) {
            const stock = Number(snaps[i].data()?.stock || 0)
            if (stock < productLines[i].qty) throw new Error(`Stock insuficiente para ${productLines[i].name}. Disponible: ${stock}`)
          }
        }
        tx.set(documentRef, {
          number, type: form.type, customerId: form.customerId || '', customerName: form.customerName, customerPhone: form.customerPhone,
          customerEmail: form.customerEmail, customerAddress: form.customerAddress, notes: form.notes, lines,
          subtotal: calc.subtotal, tax: calc.tax, total: calc.total, taxLabel: store?.taxLabel || 'IVA', taxRate: Number(store?.taxRate || 0),
          paymentMethod: form.paymentMethod || '', createdAt: serverTimestamp(), createdAtText,
        })
        if (form.type === 'invoice' && saleRef) {
          const costTotal = lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.cost || 0), 0)
          tx.set(saleRef, {
            number, source: 'invoice', documentId: documentRef.id, customerId: form.customerId || '', customerName: form.customerName || 'Consumidor final',
            paymentMethod: form.paymentMethod || 'Efectivo', lines, subtotal: calc.subtotal, discount: 0, tax: calc.tax, total: calc.total, costTotal,
            createdAt: serverTimestamp(), createdAtText,
          })
        }
        if (form.type === 'invoice') {
          snaps.forEach((snap, i) => {
            const before = Number(snap.data()?.stock || 0)
            const line = productLines[i]
            const after = before - Number(line.qty || 0)
            tx.update(productRefs[i], { stock:after, updatedAt:serverTimestamp() })
            tx.set(movementRefs[i], {
              productId:line.productId, productName:snap.data()?.name || line.name, sku:snap.data()?.sku || '', type:'exit', source:'invoice',
              reason:'Factura emitida', reference:number, notes:form.customerName ? `Cliente: ${form.customerName}` : '', quantity:Number(line.qty || 0),
              balanceBefore:before, balanceAfter:after, unitCost:Number(snap.data()?.cost || line.cost || 0), date:createdAtText.slice(0,10),
              createdAt:serverTimestamp(), createdAtText,
            })
          })
        }
      })
      setOpen(false); setForm(blankForm)
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  function printDocument(d) {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return alert('Permite ventanas emergentes para imprimir.')
    const rows = (d.lines || []).map(l => `<tr><td>${escapeHtml(l.name)}</td><td>${l.qty}</td><td>${money(l.price, store?.currency)}</td><td>${money(l.qty*l.price, store?.currency)}</td></tr>`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.number)}</title><style>body{font-family:Arial,sans-serif;color:#111;padding:40px}header{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:20px;margin-bottom:28px}.logo{max-width:100px;max-height:70px}h1{margin:0 0 5px}.meta{text-align:right}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.totals{margin:24px 0 0 auto;width:320px}.totals div{display:flex;justify-content:space-between;padding:6px 0}.grand{font-weight:700;font-size:20px;border-top:2px solid #111}.notes{margin-top:35px;color:#444}@media print{button{display:none}}</style></head><body><header><div>${store?.logoUrl ? `<img class="logo" src="${escapeHtml(store.logoUrl)}">` : ''}<h1>${escapeHtml(store?.name || '')}</h1><div>${escapeHtml(store?.address || '')}</div><div>${escapeHtml(store?.phone || '')}</div></div><div class="meta"><h2>${d.type === 'invoice' ? 'FACTURA' : 'COTIZACIÓN'}</h2><strong>${escapeHtml(d.number)}</strong><div>${new Date(d.createdAtText || Date.now()).toLocaleDateString('es-NI')}</div></div></header><section><strong>Cliente:</strong> ${escapeHtml(d.customerName || 'Consumidor final')}<br><strong>Teléfono:</strong> ${escapeHtml(d.customerPhone || '—')}<br>${d.customerEmail ? `<strong>Correo:</strong> ${escapeHtml(d.customerEmail)}<br>` : ''}${d.customerAddress ? `<strong>Dirección:</strong> ${escapeHtml(d.customerAddress)}` : ''}</section><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Subtotal</span><span>${money(d.subtotal, store?.currency)}</span></div><div><span>${escapeHtml(d.taxLabel || 'IVA')} (${d.taxRate || 0}%)</span><span>${money(d.tax, store?.currency)}</span></div><div class="grand"><span>Total</span><span>${money(d.total, store?.currency)}</span></div></div>${d.notes ? `<div class="notes"><strong>Notas:</strong> ${escapeHtml(d.notes)}</div>` : ''}<script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
  }

  return <>
    <PageHeader title="Facturas y cotizaciones" subtitle="Crea documentos imprimibles; las facturas descuentan stock automáticamente."><button className="btn primary" onClick={() => setOpen(true)}><FilePlus2 size={17}/> Nuevo documento</button></PageHeader>
    <div className="card table-card">{documents.length ? <div className="table-wrap"><table><thead><tr><th>Número</th><th>Tipo</th><th>Cliente</th><th>Total</th><th>Fecha</th><th></th></tr></thead><tbody>{documents.map(d => <tr key={d.id}><td><strong>{d.number}</strong></td><td><span className={`badge ${d.type === 'invoice' ? 'good' : 'info'}`}>{d.type === 'invoice' ? 'Factura' : 'Cotización'}</span></td><td>{d.customerName || 'Consumidor final'}</td><td>{money(d.total, store?.currency)}</td><td>{new Date(d.createdAtText || Date.now()).toLocaleDateString('es-NI')}</td><td><button className="btn ghost" onClick={() => printDocument(d)}><Printer size={16}/> Imprimir</button></td></tr>)}</tbody></table></div> : <EmptyState title="Sin documentos" text="Crea tu primera factura o cotización." />}</div>
    <Modal open={open} title="Nuevo documento" onClose={() => setOpen(false)} wide>
      <form onSubmit={save} className="form-stack modal-form">
        <div className="form-grid">
          <label>Tipo<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="quote">Cotización</option><option value="invoice">Factura</option></select></label>
          <label>Cliente guardado<select value={form.customerId} onChange={e => selectCustomer(e.target.value)}><option value="">Consumidor final / manual</option>{customers.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <label>Nombre del cliente<input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value, customerId: '' })}/></label>
          <label>Teléfono<input value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })}/></label>
          <label>Correo<input type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })}/></label>
          <label>Dirección<input value={form.customerAddress} onChange={e => setForm({ ...form, customerAddress: e.target.value })}/></label>
          <label>Método de pago<select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Crédito</option><option>Otro</option></select></label>
        </div>
        <div className="document-lines"><div className="line line-head"><span>Producto</span><span>Cantidad</span><span>Precio</span><span>Total</span><span></span></div>{form.lines.map((l, i) => <div className="line" key={i}><select value={l.productId} onChange={e => selectProduct(i, e.target.value)}><option value="">Seleccionar…</option>{products.filter(p => p.active !== false).map(p => <option value={p.id} key={p.id}>{p.name} ({p.stock || 0})</option>)}</select><input type="number" min="1" value={l.qty} onChange={e => setLine(i, { qty: e.target.value })}/><input type="number" min="0" step="0.01" value={l.price} onChange={e => setLine(i, { price: e.target.value })}/><strong>{money(Number(l.qty||0)*Number(l.price||0), store?.currency)}</strong><button type="button" className="icon-btn" onClick={() => setForm({ ...form, lines: form.lines.filter((_, x) => x !== i) })}><X size={16}/></button></div>)}</div>
        <button type="button" className="btn ghost self-start" onClick={() => setForm({ ...form, lines: [...form.lines, newLine()] })}>+ Agregar línea</button>
        <label>Notas<textarea rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label>
        <div className="doc-summary"><span>Subtotal <strong>{money(calc.subtotal, store?.currency)}</strong></span><span>{store?.taxLabel || 'IVA'} <strong>{money(calc.tax, store?.currency)}</strong></span><span className="doc-total">Total <strong>{money(calc.total, store?.currency)}</strong></span></div>
        <div className="form-footer"><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="btn primary" disabled={saving}>{saving ? 'Guardando…' : form.type === 'invoice' ? 'Emitir factura' : 'Guardar cotización'}</button></div>
      </form>
    </Modal>
  </>
}
