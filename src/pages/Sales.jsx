import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { Banknote, CalendarDays, CreditCard, Pencil, Plus, Printer, ReceiptText, Save, Trash2, TrendingUp, X } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { money } from '../utils/format'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const safeDate = v => {
  const d = new Date(v || 0)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}
const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]))
const toLocalInput = value => {
  const d = safeDate(value)
  if (!d.getTime()) return ''
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0,16)
}
const toIso = value => {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}
const qtyMap = lines => (lines || []).reduce((map, line) => {
  if (!line.productId) return map
  map.set(line.productId, (map.get(line.productId) || 0) + Number(line.qty || 0))
  return map
}, new Map())

export default function Sales() {
  const { user, store } = useAuth()
  const [sales, setSales] = useState([])
  const [documents, setDocuments] = useState([])
  const [products, setProducts] = useState([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7))
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    if (!user) return
    const a = onSnapshot(collection(db,'stores',user.uid,'sales'), s => setSales(s.docs.map(d=>({id:d.id,...d.data()}))))
    const b = onSnapshot(collection(db,'stores',user.uid,'documents'), s => setDocuments(s.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.type==='invoice')))
    const c = onSnapshot(collection(db,'stores',user.uid,'products'), s => setProducts(s.docs.map(d=>({id:d.id,...d.data()}))))
    return () => { a(); b(); c() }
  },[user])

  const allSales = useMemo(() => {
    const map = new Map()
    sales.forEach(s => map.set(s.number || s.id, { ...s, _saleRecord:true }))
    documents.forEach(d => {
      if (!map.has(d.number)) map.set(d.number, { ...d, source:'invoice', documentId:d.id, paymentMethod:d.paymentMethod || 'Factura', costTotal:Number(d.costTotal||0), _saleRecord:false })
    })
    return [...map.values()].sort((a,b)=>safeDate(b.createdAtText)-safeDate(a.createdAtText))
  },[sales,documents])

  const filtered = allSales.filter(s => String(s.createdAtText || '').slice(0,7)===month)
  const total = filtered.reduce((a,s)=>a+Number(s.total||0),0)
  const cost = filtered.reduce((a,s)=>a+Number(s.costTotal||0),0)
  const profit = total-cost
  const cash = filtered.filter(s=>s.paymentMethod==='Efectivo').reduce((a,s)=>a+Number(s.total||0),0)

  const editCalc = useMemo(() => {
    if (!editForm) return { subtotal:0, discount:0, tax:0, total:0, taxRate:0 }
    const subtotal = (editForm.lines || []).reduce((a,l)=>a + Number(l.qty||0)*Number(l.price||0),0)
    const discount = Math.min(subtotal, Math.max(0, Number(editForm.discount||0)))
    const taxRate = Math.max(0, Number(editForm.taxRate || 0))
    const taxable = Math.max(0, subtotal-discount)
    const tax = taxable * taxRate/100
    return { subtotal, discount, tax, total:taxable+tax, taxRate }
  },[editForm])

  function printSale(s) {
    const w = window.open('','_blank','width=520,height=760')
    if (!w) return alert('Permite ventanas emergentes para imprimir.')
    const lines=(s.lines||[]).map(l=>`<tr><td>${esc(l.name)}</td><td>${l.qty}</td><td>${money(l.price,store?.currency)}</td><td>${money(Number(l.qty)*Number(l.price),store?.currency)}</td></tr>`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.number)}</title><style>body{font:14px Arial;padding:24px;color:#111}.head{text-align:center;border-bottom:1px dashed #999;padding-bottom:16px}.logo{max-width:82px;max-height:62px}.meta{margin:16px 0;line-height:1.6}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:7px 3px;border-bottom:1px solid #eee}th{font-size:11px}.sum{margin-top:16px;border-top:1px dashed #999;padding-top:10px}.sum div{display:flex;justify-content:space-between;padding:4px 0}.grand{font-size:18px;font-weight:700}.thanks{text-align:center;margin-top:26px;color:#555}@media print{body{padding:0}}</style></head><body><div class="head">${store?.logoUrl?`<img class="logo" src="${esc(store.logoUrl)}">`:''}<h2>${esc(store?.name||'Mi Tienda')}</h2><div>${esc(store?.address||'')}</div><div>${esc(store?.phone||'')}</div></div><div class="meta"><strong>${esc(s.number||'Venta')}</strong><br>${safeDate(s.createdAtText).toLocaleString('es-NI')}<br>Cliente: ${esc(s.customerName||'Consumidor final')}<br>Pago: ${esc(s.paymentMethod||'—')}</div><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table><div class="sum"><div><span>Subtotal</span><span>${money(s.subtotal,store?.currency)}</span></div>${Number(s.discount||0)>0?`<div><span>Descuento</span><span>-${money(s.discount,store?.currency)}</span></div>`:''}<div><span>${esc(store?.taxLabel||'IVA')}</span><span>${money(s.tax,store?.currency)}</span></div><div class="grand"><span>Total</span><span>${money(s.total,store?.currency)}</span></div></div><p class="thanks">¡Gracias por su compra!</p><script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
  }

  function startEdit(s) {
    const taxable = Math.max(0, Number(s.subtotal||0)-Number(s.discount||0))
    const inferredRate = taxable > 0 ? (Number(s.tax||0)/taxable)*100 : Number(store?.taxRate||0)
    setEditing(s)
    setEditForm({
      customerName:s.customerName || 'Consumidor final',
      paymentMethod:s.paymentMethod || 'Efectivo',
      createdAtText:toLocalInput(s.createdAtText),
      discount:Number(s.discount||0),
      taxRate:Number.isFinite(Number(s.taxRate)) ? Number(s.taxRate) : inferredRate,
      lines:(s.lines || []).map(l=>({ ...l, qty:Number(l.qty||1), price:Number(l.price||0), cost:Number(l.cost||0) })),
    })
  }

  function updateLine(index, patch) {
    setEditForm(current => ({ ...current, lines:current.lines.map((line,i)=>i===index?{...line,...patch}:line) }))
  }

  function chooseProduct(index, productId) {
    const p = products.find(x=>x.id===productId)
    if (!p) return updateLine(index,{ productId:'', name:'', sku:'', cost:0 })
    updateLine(index,{ productId:p.id, name:p.name, sku:p.sku||'', price:Number(p.price||0), cost:Number(p.cost||0) })
  }

  function addEditLine() {
    setEditForm(current => ({ ...current, lines:[...current.lines,{ productId:'', name:'', sku:'', qty:1, price:0, cost:0 }] }))
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editing || !editForm) return
    const nextLines = editForm.lines
      .filter(l=>String(l.name||'').trim() && Number(l.qty)>0)
      .map(l=>({ ...l, name:String(l.name).trim(), qty:Number(l.qty), price:Math.max(0,Number(l.price||0)), cost:Math.max(0,Number(l.cost||0)) }))
    if (!nextLines.length) return alert('La venta debe conservar al menos una línea.')
    setSaving(true)
    try {
      const oldMap = qtyMap(editing.lines)
      const nextMap = qtyMap(nextLines)
      const productIds = [...new Set([...oldMap.keys(),...nextMap.keys()])]
      const productRefs = productIds.map(id=>doc(db,'stores',user.uid,'products',id))
      const movementRefs = new Map(productIds.filter(id => Number(oldMap.get(id)||0) !== Number(nextMap.get(id)||0)).map(id => [id, doc(collection(db,'stores',user.uid,'inventoryMovements'))]))
      const saleRef = editing._saleRecord ? doc(db,'stores',user.uid,'sales',editing.id) : doc(db,'stores',user.uid,'sales',editing.id)
      const documentId = editing.documentId || (editing.source==='invoice' ? editing.id : '')
      const documentRef = documentId ? doc(db,'stores',user.uid,'documents',documentId) : null
      const createdAtText = toIso(editForm.createdAtText)
      const movementCreatedAtText = new Date().toISOString()

      await runTransaction(db, async tx => {
        const productSnaps = await Promise.all(productRefs.map(ref=>tx.get(ref)))
        const productsById = new Map(productSnaps.map((snap,i)=>[productIds[i],snap]))
        for (const id of productIds) {
          const snap = productsById.get(id)
          if (!snap?.exists()) throw new Error('Uno de los productos de esta venta ya no existe.')
          const availableAfterRestore = Number(snap.data()?.stock||0) + Number(oldMap.get(id)||0)
          const wanted = Number(nextMap.get(id)||0)
          if (availableAfterRestore < wanted) throw new Error(`Stock insuficiente para ${snap.data()?.name || 'un producto'}. Disponible al corregir: ${availableAfterRestore}`)
        }

        const normalizedLines = nextLines.map(line => {
          if (!line.productId) return line
          const snap = productsById.get(line.productId)
          return { ...line, name:snap?.data()?.name || line.name, sku:snap?.data()?.sku || line.sku || '', cost:Number(snap?.data()?.cost ?? line.cost ?? 0) }
        })
        const costTotal = normalizedLines.reduce((sum,line)=>sum + Number(line.qty||0)*Number(line.cost||0),0)
        const payload = {
          number:editing.number,
          source:editing.source || 'pos',
          documentId:documentId || '',
          customerName:editForm.customerName.trim() || 'Consumidor final',
          paymentMethod:editForm.paymentMethod,
          lines:normalizedLines,
          subtotal:editCalc.subtotal,
          discount:editCalc.discount,
          tax:editCalc.tax,
          taxRate:editCalc.taxRate,
          total:editCalc.total,
          costTotal,
          createdAtText,
          updatedAt:serverTimestamp(),
        }
        tx.set(saleRef,payload,{merge:true})
        if (documentRef) tx.set(documentRef,{
          customerName:payload.customerName,
          paymentMethod:payload.paymentMethod,
          lines:normalizedLines,
          subtotal:payload.subtotal,
          tax:payload.tax,
          taxRate:payload.taxRate,
          total:payload.total,
          createdAtText,
          updatedAt:serverTimestamp(),
        },{merge:true})
        productIds.forEach((id,i)=>{
          const snap = productSnaps[i]
          const before = Number(snap.data()?.stock || 0)
          const delta = Number(oldMap.get(id)||0) - Number(nextMap.get(id)||0)
          const nextStock = before + delta
          tx.update(productRefs[i],{ stock:nextStock, updatedAt:serverTimestamp() })
          if (delta !== 0) {
            tx.set(movementRefs.get(id), {
              productId:id, productName:snap.data()?.name || 'Producto', sku:snap.data()?.sku || '', type:delta > 0 ? 'entry' : 'exit', source:'sale_edit',
              reason:'Corrección de venta', reference:editing.number || '', notes:'Ajuste automático por edición de venta', quantity:Math.abs(delta),
              balanceBefore:before, balanceAfter:nextStock, unitCost:Number(snap.data()?.cost || 0), date:movementCreatedAtText.slice(0,10),
              createdAt:serverTimestamp(), createdAtText:movementCreatedAtText,
            })
          }
        })
      })
      setEditing(null); setEditForm(null)
      alert(`Venta ${editing.number || ''} actualizada correctamente.`)
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  async function deleteSale(s) {
    const invoiceWarning = s.source === 'invoice' ? '\nTambién se eliminará la factura asociada.' : ''
    if (!window.confirm(`¿Eliminar ${s.number || 'esta venta'}?\nEl stock vendido será devuelto al inventario.${invoiceWarning}\n\nEsta acción no se puede deshacer.`)) return
    setDeletingId(s.id || s.number)
    try {
      const oldMap = qtyMap(s.lines)
      const productIds = [...oldMap.keys()]
      const productRefs = productIds.map(id=>doc(db,'stores',user.uid,'products',id))
      const movementRefs = productIds.map(() => doc(collection(db,'stores',user.uid,'inventoryMovements')))
      const saleRef = s._saleRecord ? doc(db,'stores',user.uid,'sales',s.id) : null
      const documentId = s.documentId || (s.source==='invoice' ? s.id : '')
      const documentRef = documentId ? doc(db,'stores',user.uid,'documents',documentId) : null

      await runTransaction(db, async tx => {
        const productSnaps = await Promise.all(productRefs.map(ref=>tx.get(ref)))
        productSnaps.forEach((snap,i)=>{
          if (snap.exists()) {
            const before = Number(snap.data()?.stock || 0)
            const quantity = Number(oldMap.get(productIds[i]) || 0)
            const after = before + quantity
            tx.update(productRefs[i],{ stock:after, updatedAt:serverTimestamp() })
            tx.set(movementRefs[i], {
              productId:productIds[i], productName:snap.data()?.name || 'Producto', sku:snap.data()?.sku || '', type:'entry', source:'sale_delete',
              reason:'Venta eliminada', reference:s.number || '', notes:'Stock restaurado automáticamente al eliminar la venta', quantity,
              balanceBefore:before, balanceAfter:after, unitCost:Number(snap.data()?.cost || 0), date:new Date().toISOString().slice(0,10),
              createdAt:serverTimestamp(), createdAtText:new Date().toISOString(),
            })
          }
        })
        if (saleRef) tx.delete(saleRef)
        if (documentRef) tx.delete(documentRef)
      })
      alert('Venta eliminada y existencias restauradas.')
    } catch (err) { alert(`No se pudo eliminar la venta: ${err.message}`) } finally { setDeletingId('') }
  }

  return <>
    <PageHeader title="Ventas" subtitle="Historial unificado de ventas del POS y facturas emitidas. Ahora puedes corregir o eliminar ventas sin perder el control del stock.">
      <label className="month-picker"><CalendarDays size={17}/><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
    </PageHeader>
    <div className="finance-stats-grid four">
      <article className="card finance-stat green"><span><TrendingUp/></span><div><small>Ingresos del mes</small><strong>{money(total,store?.currency)}</strong><em>{filtered.length} ventas</em></div></article>
      <article className="card finance-stat blue"><span><ReceiptText/></span><div><small>Ticket promedio</small><strong>{money(filtered.length?total/filtered.length:0,store?.currency)}</strong><em>Promedio por venta</em></div></article>
      <article className="card finance-stat purple"><span><Banknote/></span><div><small>Ingresos en efectivo</small><strong>{money(cash,store?.currency)}</strong><em>Registrado por POS</em></div></article>
      <article className="card finance-stat orange"><span><CreditCard/></span><div><small>Margen bruto estimado</small><strong>{money(profit,store?.currency)}</strong><em>Cuando hay costo registrado</em></div></article>
    </div>
    <div className="card table-card">{filtered.length?<div className="table-wrap"><table><thead><tr><th>Número</th><th>Origen</th><th>Cliente</th><th>Pago</th><th>Fecha</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{filtered.map(s=><tr key={`${s._saleRecord?'sale':'doc'}-${s.id||s.number}`}><td><strong>{s.number||'—'}</strong></td><td><span className={`badge ${s.source==='pos'?'good':'info'}`}>{s.source==='pos'?'POS':'Factura'}</span></td><td>{s.customerName||'Consumidor final'}</td><td>{s.paymentMethod||'—'}</td><td>{safeDate(s.createdAtText).toLocaleString('es-NI')}</td><td><strong>{money(s.total,store?.currency)}</strong></td><td><div className="sale-actions"><button className="icon-btn" title="Editar venta" onClick={()=>startEdit(s)}><Pencil size={15}/></button><button className="icon-btn" title="Imprimir" onClick={()=>printSale(s)}><Printer size={15}/></button><button className="icon-btn danger" title="Eliminar venta" disabled={deletingId===(s.id||s.number)} onClick={()=>deleteSale(s)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>:<EmptyState title="Sin ventas en este mes" text="Las ventas del POS y nuevas facturas aparecerán aquí."/>}</div>

    <Modal open={Boolean(editing && editForm)} title={`Editar ${editing?.number || 'venta'}`} onClose={()=>{ if (!saving) { setEditing(null); setEditForm(null) } }} wide>
      {editForm && <form onSubmit={saveEdit} className="form-stack modal-form sale-edit-form">
        <div className="alert info">Al guardar, el sistema recalcula el inventario usando la venta original y la venta corregida. Si esta venta nació de una factura, la factura se actualizará también.</div>
        <div className="form-grid">
          <label>Cliente<input value={editForm.customerName} onChange={e=>setEditForm({...editForm,customerName:e.target.value})}/></label>
          <label>Método de pago<select value={editForm.paymentMethod} onChange={e=>setEditForm({...editForm,paymentMethod:e.target.value})}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Crédito</option><option>Otro</option><option>Factura</option></select></label>
          <label>Fecha y hora<input type="datetime-local" value={editForm.createdAtText} onChange={e=>setEditForm({...editForm,createdAtText:e.target.value})}/></label>
          <label>Descuento<input type="number" min="0" step="0.01" value={editForm.discount} onChange={e=>setEditForm({...editForm,discount:e.target.value})}/></label>
        </div>

        <div className="sale-edit-lines">
          <div className="sale-edit-line sale-edit-head"><span>Producto</span><span>Nombre</span><span>Cant.</span><span>Precio</span><span>Total</span><span></span></div>
          {editForm.lines.map((line,index)=><div className="sale-edit-line" key={`${line.productId || 'manual'}-${index}`}>
            <select value={line.productId || ''} onChange={e=>chooseProduct(index,e.target.value)}><option value="">Manual</option>{products.filter(p=>p.active!==false || p.id===line.productId).map(p=><option key={p.id} value={p.id}>{p.name} · stock {p.stock||0}</option>)}</select>
            <input value={line.name || ''} onChange={e=>updateLine(index,{name:e.target.value})} placeholder="Producto"/>
            <input type="number" min="1" step="1" value={line.qty} onChange={e=>updateLine(index,{qty:e.target.value})}/>
            <input type="number" min="0" step="0.01" value={line.price} onChange={e=>updateLine(index,{price:e.target.value})}/>
            <strong>{money(Number(line.qty||0)*Number(line.price||0),store?.currency)}</strong>
            <button type="button" className="icon-btn danger" onClick={()=>setEditForm({...editForm,lines:editForm.lines.filter((_,i)=>i!==index)})}><X size={15}/></button>
          </div>)}
        </div>
        <button type="button" className="btn ghost self-start" onClick={addEditLine}><Plus size={16}/> Agregar línea</button>
        <div className="sale-edit-summary"><span>Subtotal <b>{money(editCalc.subtotal,store?.currency)}</b></span><span>Descuento <b>- {money(editCalc.discount,store?.currency)}</b></span><span>{store?.taxLabel || 'IVA'} ({editCalc.taxRate.toFixed(2)}%) <b>{money(editCalc.tax,store?.currency)}</b></span><strong>Total <b>{money(editCalc.total,store?.currency)}</b></strong></div>
        <div className="form-footer"><button type="button" className="btn ghost" onClick={()=>{setEditing(null);setEditForm(null)}} disabled={saving}>Cancelar</button><button className="btn primary" disabled={saving}><Save size={16}/>{saving?'Guardando…':'Guardar cambios'}</button></div>
      </form>}
    </Modal>
  </>
}
