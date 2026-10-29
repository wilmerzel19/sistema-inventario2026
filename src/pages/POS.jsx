import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { Banknote, Minus, Plus, Search, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { money } from '../utils/format'
import PageHeader from '../components/PageHeader'

export default function POS() {
  const { user, store } = useAuth()
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')
  const [customerName, setCustomerName] = useState('')
  const [discount, setDiscount] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    const a = onSnapshot(collection(db, 'stores', user.uid, 'products'), s => setProducts(s.docs.map(d => ({ id:d.id, ...d.data() }))))
    const b = onSnapshot(collection(db, 'stores', user.uid, 'sales'), s => setSales(s.docs.map(d => ({ id:d.id, ...d.data() }))))
    return () => { a(); b() }
  }, [user])

  const visible = useMemo(() => products.filter(p => p.active !== false && Number(p.stock || 0) > 0 && `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(search.toLowerCase())), [products,search])
  const subtotal = cart.reduce((a,l) => a + Number(l.qty)*Number(l.price),0)
  const tax = Math.max(0, subtotal - Number(discount || 0)) * (Number(store?.taxRate || 0)/100)
  const total = Math.max(0, subtotal - Number(discount || 0)) + tax
  const todayKey = new Date().toISOString().slice(0,10)
  const todaySales = sales.filter(s => String(s.createdAtText || '').slice(0,10) === todayKey)
  const todayTotal = todaySales.reduce((a,s) => a + Number(s.total || 0),0)

  function addProduct(p) {
    setCart(current => {
      const found = current.find(x => x.productId === p.id)
      if (found) return current.map(x => x.productId===p.id ? { ...x, qty: Math.min(Number(p.stock||0), x.qty+1) } : x)
      return [...current, { productId:p.id, name:p.name, sku:p.sku || '', qty:1, price:Number(p.price||0), cost:Number(p.cost||0), stock:Number(p.stock||0), imageUrl:p.imageUrl || '' }]
    })
  }

  function changeQty(id, next) {
    setCart(current => current.map(x => x.productId===id ? { ...x, qty:Math.max(1, Math.min(x.stock, next)) } : x))
  }

  async function checkout() {
    if (!cart.length) return alert('Agrega productos al carrito.')
    setSaving(true)
    try {
      const saleRef = doc(collection(db, 'stores', user.uid, 'sales'))
      const refs = cart.map(l => doc(db, 'stores', user.uid, 'products', l.productId))
      const number = `POS-${Date.now().toString().slice(-8)}`
      const createdAtText = new Date().toISOString()
      const movementRefs = cart.map(() => doc(collection(db, 'stores', user.uid, 'inventoryMovements')))
      await runTransaction(db, async tx => {
        const snaps = await Promise.all(refs.map(r => tx.get(r)))
        snaps.forEach((snap,i) => {
          if (!snap.exists()) throw new Error(`${cart[i].name} ya no existe.`)
          const stock = Number(snap.data()?.stock || 0)
          if (stock < cart[i].qty) throw new Error(`Stock insuficiente para ${cart[i].name}. Disponible: ${stock}`)
        })
        const lines = cart.map((l,i) => ({ productId:l.productId, name:l.name, sku:l.sku, qty:Number(l.qty), price:Number(l.price), cost:Number(snaps[i].data()?.cost || l.cost || 0) }))
        const costTotal = lines.reduce((a,l) => a + l.qty*l.cost,0)
        tx.set(saleRef, {
          number, source:'pos', customerName:customerName.trim() || 'Consumidor final', paymentMethod,
          lines, subtotal, discount:Number(discount||0), tax, total, costTotal,
          createdAt:serverTimestamp(), createdAtText,
        })
        snaps.forEach((snap,i) => {
          const before = Number(snap.data()?.stock || 0)
          const after = before - Number(cart[i].qty || 0)
          tx.update(refs[i], { stock:after, updatedAt:serverTimestamp() })
          tx.set(movementRefs[i], {
            productId:cart[i].productId, productName:cart[i].name, sku:cart[i].sku || '', type:'exit', source:'pos',
            reason:'Venta POS', reference:number, notes:'Salida automática por venta', quantity:Number(cart[i].qty || 0),
            balanceBefore:before, balanceAfter:after, unitCost:Number(snaps[i].data()?.cost || cart[i].cost || 0),
            date:createdAtText.slice(0,10), createdAt:serverTimestamp(), createdAtText,
          })
        })
      })
      setCart([]); setDiscount(0); setCustomerName('')
      alert(`Venta ${number} registrada correctamente.`)
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  return <>
    <PageHeader title="POS · Punto de venta" subtitle="Vende rápido, descuenta inventario y registra el ingreso automáticamente." />

    <div className="pos-stats">
      <div><span><Banknote size={17}/></span><small>Ventas de hoy</small><strong>{money(todayTotal, store?.currency)}</strong></div>
      <div><span><ShoppingBag size={17}/></span><small>Transacciones</small><strong>{todaySales.length}</strong></div>
      <div><span><ShoppingCart size={17}/></span><small>Carrito actual</small><strong>{cart.reduce((a,l)=>a+l.qty,0)} uds.</strong></div>
    </div>

    <div className="pos-layout">
      <section className="card pos-products">
        <div className="pos-search"><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto, SKU o categoría…"/></div>
        <div className="pos-product-grid">
          {visible.map(p => <button type="button" key={p.id} className="pos-product-card" onClick={() => addProduct(p)}>
            <div className="pos-product-image">{p.imageUrl ? <img src={p.imageUrl} alt=""/> : <ShoppingBag/>}<span>{p.stock || 0} uds.</span></div>
            <div><strong>{p.name}</strong><small>{p.sku || p.category || 'Producto'}</small><b>{money(p.price,store?.currency)}</b></div>
          </button>)}
          {!visible.length && <div className="pos-no-products">No hay productos disponibles con esa búsqueda.</div>}
        </div>
      </section>

      <aside className="card pos-cart">
        <div className="pos-cart-head"><div><small>VENTA ACTUAL</small><h2>Carrito</h2></div><span>{cart.length}</span></div>
        <div className="pos-cart-lines">
          {cart.length ? cart.map(l => <div className="pos-cart-line" key={l.productId}>
            <div className="pos-cart-thumb">{l.imageUrl ? <img src={l.imageUrl} alt=""/> : <ShoppingBag size={17}/>}</div>
            <div className="pos-cart-info"><strong>{l.name}</strong><small>{money(l.price,store?.currency)} c/u</small><div className="qty-control"><button onClick={()=>changeQty(l.productId,l.qty-1)}><Minus size={13}/></button><span>{l.qty}</span><button onClick={()=>changeQty(l.productId,l.qty+1)}><Plus size={13}/></button></div></div>
            <div className="pos-line-total"><strong>{money(l.qty*l.price,store?.currency)}</strong><button className="cart-remove" onClick={()=>setCart(cart.filter(x=>x.productId!==l.productId))}><Trash2 size={15}/></button></div>
          </div>) : <div className="pos-empty"><ShoppingCart size={30}/><strong>Carrito vacío</strong><span>Toca un producto para agregarlo.</span></div>}
        </div>
        <div className="pos-fields">
          <label>Cliente<input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Consumidor final"/></label>
          <div className="pos-field-row"><label>Pago<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Crédito</option><option>Otro</option></select></label><label>Descuento<input type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)}/></label></div>
        </div>
        <div className="pos-summary"><div><span>Subtotal</span><b>{money(subtotal,store?.currency)}</b></div><div><span>Descuento</span><b>- {money(discount,store?.currency)}</b></div><div><span>{store?.taxLabel || 'IVA'} ({Number(store?.taxRate||0)}%)</span><b>{money(tax,store?.currency)}</b></div><div className="pos-grand"><span>Total</span><strong>{money(total,store?.currency)}</strong></div></div>
        <button className="btn primary pos-pay" disabled={!cart.length || saving} onClick={checkout}><Banknote size={18}/>{saving ? 'Procesando…' : `Cobrar ${money(total,store?.currency)}`}</button>
      </aside>
    </div>
  </>
}
