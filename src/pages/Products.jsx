import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { ArrowLeftRight, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, FilterX, ImagePlus, Pencil, Plus, Search, SlidersHorizontal, Trash2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { db, storage } from '../lib/firebase'
import { uploadProductPhotoToGooglePhotos } from '../lib/googlePhotos'
import { useAuth } from '../context/AuthContext'
import { exportProducts, importProducts } from '../utils/excel'
import { money } from '../utils/format'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const blank = { sku: '', name: '', category: '', price: '', cost: '', stock: '', minStock: '2', imageUrl: '', googlePhotosMediaItemId: '', googlePhotosProductUrl: '', description: '', active: true }

export default function Products() {
  const { user, store, getGooglePhotosAccessToken } = useAuth()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [visibility, setVisibility] = useState('all')
  const [sortBy, setSortBy] = useState('name-asc')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [uploading, setUploading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [backupToGooglePhotos, setBackupToGooglePhotos] = useState(true)
  const [googlePhotosStatus, setGooglePhotosStatus] = useState('')
  const fileRef = useRef(null)

  useEffect(() => user ? onSnapshot(collection(db, 'stores', user.uid, 'products'), (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))) : undefined, [user])

  const categories = useMemo(() => [...new Set(products.map(p => (p.category || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'es')), [products])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const low = minPrice === '' ? null : Number(minPrice)
    const high = maxPrice === '' ? null : Number(maxPrice)
    const result = products.filter(p => {
      const stock = Number(p.stock || 0)
      const minStock = Number(p.minStock || 0)
      const price = Number(p.price || 0)
      if (term && !`${p.name || ''} ${p.sku || ''} ${p.category || ''} ${p.description || ''}`.toLowerCase().includes(term)) return false
      if (category !== 'all' && (p.category || '') !== category) return false
      if (visibility === 'active' && p.active === false) return false
      if (visibility === 'hidden' && p.active !== false) return false
      if (stockFilter === 'out' && stock !== 0) return false
      if (stockFilter === 'low' && !(stock > 0 && stock <= minStock)) return false
      if (stockFilter === 'available' && stock <= minStock) return false
      if (low !== null && Number.isFinite(low) && price < low) return false
      if (high !== null && Number.isFinite(high) && price > high) return false
      return true
    })
    return result.sort((a,b) => {
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '', 'es')
      if (sortBy === 'price-asc') return Number(a.price || 0) - Number(b.price || 0)
      if (sortBy === 'price-desc') return Number(b.price || 0) - Number(a.price || 0)
      if (sortBy === 'stock-asc') return Number(a.stock || 0) - Number(b.stock || 0)
      if (sortBy === 'stock-desc') return Number(b.stock || 0) - Number(a.stock || 0)
      if (sortBy === 'newest') return Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0)
      return (a.name || '').localeCompare(b.name || '', 'es')
    })
  }, [products, search, category, stockFilter, visibility, sortBy, minPrice, maxPrice])

  useEffect(() => setPage(1), [search, category, stockFilter, visibility, sortBy, minPrice, maxPrice, pageSize])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize])
  const visiblePages = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4))
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i)
  }, [page, totalPages])
  const activeFilters = [category !== 'all', stockFilter !== 'all', visibility !== 'all', minPrice !== '', maxPrice !== '', search !== ''].filter(Boolean).length

  function clearFilters() { setSearch(''); setCategory('all'); setStockFilter('all'); setVisibility('all'); setSortBy('name-asc'); setMinPrice(''); setMaxPrice(''); setPage(1) }
  function newProduct() { setEditing(null); setForm(blank); setImageError(''); setGooglePhotosStatus(''); setOpen(true) }
  function edit(p) { setEditing(p); setForm({ ...blank, ...p }); setImageError(''); setGooglePhotosStatus(p.googlePhotosMediaItemId ? 'Esta imagen tiene copia en Google Photos.' : ''); setOpen(true) }

  async function uploadImage(file) {
    if (!file) return
    setImageError('')
    setGooglePhotosStatus('')
    if (!file.type.startsWith('image/')) return setImageError('Selecciona una imagen válida.')
    if (file.size > 5 * 1024 * 1024) return setImageError('La imagen no debe superar 5 MB.')

    setUploading(true)
    let photosToken = null

    // Pide el permiso de Google Photos antes de iniciar otras esperas para evitar bloqueos del popup.
    if (backupToGooglePhotos) {
      try {
        photosToken = await getGooglePhotosAccessToken()
        setGooglePhotosStatus('Google Photos conectado. Subiendo copia…')
      } catch (err) {
        console.error('Google Photos authorization:', err)
        setGooglePhotosStatus('La foto se guardará en el sistema, pero no se autorizó la copia en Google Photos.')
      }
    }

    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const imageRef = ref(storage, `stores/${user.uid}/products/${Date.now()}-${safe}`)
      await uploadBytes(imageRef, file, { contentType: file.type })
      const url = await getDownloadURL(imageRef)
      setForm(prev => ({ ...prev, imageUrl: url }))

      if (photosToken) {
        try {
          const photosItem = await uploadProductPhotoToGooglePhotos(file, photosToken)
          setForm(prev => ({
            ...prev,
            imageUrl: url,
            googlePhotosMediaItemId: photosItem.id,
            googlePhotosProductUrl: photosItem.productUrl,
          }))
          setGooglePhotosStatus('Foto subida al sistema y guardada también en Google Photos.')
        } catch (photosError) {
          console.error('Google Photos upload:', photosError)
          setGooglePhotosStatus('La foto quedó guardada en el sistema, pero Google Photos no pudo guardar la copia.')
        }
      } else if (!backupToGooglePhotos) {
        setGooglePhotosStatus('Foto subida correctamente al sistema.')
      }
    } catch (err) {
      console.error(err)
      setImageError('No se pudo subir. Verifica Firebase Storage, el storageBucket de tu .env y las reglas de Storage. También puedes pegar una URL.')
    } finally {
      setUploading(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    const data = { ...form, price: Number(form.price || 0), cost: Number(form.cost || 0), stock: Math.max(0, Number(form.stock || 0)), minStock: Math.max(0, Number(form.minStock || 0)), updatedAt: serverTimestamp() }
    delete data.id; delete data.createdAt
    const productRef = editing ? doc(db, 'stores', user.uid, 'products', editing.id) : doc(collection(db, 'stores', user.uid, 'products'))
    const movementRef = doc(collection(db, 'stores', user.uid, 'inventoryMovements'))
    const createdAtText = new Date().toISOString()
    await runTransaction(db, async tx => {
      let before = 0
      if (editing) {
        const snap = await tx.get(productRef)
        if (!snap.exists()) throw new Error('El producto ya no existe.')
        before = Number(snap.data()?.stock || 0)
        tx.set(productRef, data, { merge:true })
      } else tx.set(productRef, { ...data, createdAt:serverTimestamp() })
      const delta = Number(data.stock || 0) - before
      if (delta !== 0) tx.set(movementRef, {
        productId:productRef.id, productName:data.name || 'Producto', sku:data.sku || '', type:delta > 0 ? 'entry' : 'exit',
        source:editing ? 'product_adjustment' : 'opening', reason:editing ? 'Stock editado desde producto' : 'Inventario inicial',
        reference:editing ? 'Edición de producto' : 'Alta de producto', notes:'', quantity:Math.abs(delta), balanceBefore:before,
        balanceAfter:Number(data.stock || 0), unitCost:Number(data.cost || 0), date:createdAtText.slice(0,10), createdAt:serverTimestamp(), createdAtText,
      })
    })
    setOpen(false)
  }

  async function remove(p) { if (confirm(`¿Eliminar ${p.name}?`)) await deleteDoc(doc(db, 'stores', user.uid, 'products', p.id)) }

  async function handleImport(e) {
    const file = e.target.files?.[0]; if (!file) return
    const rows = await importProducts(file)
    for (let start = 0; start < rows.length; start += 200) {
      const batch = writeBatch(db)
      rows.slice(start, start + 200).forEach((row) => {
        const refDoc = doc(collection(db, 'stores', user.uid, 'products'))
        const createdAtText = new Date().toISOString()
        const normalized = { ...row, stock:Math.max(0, Number(row.stock || 0)), createdAt:serverTimestamp(), updatedAt:serverTimestamp() }
        batch.set(refDoc, normalized)
        if (normalized.stock > 0) {
          const movementRef = doc(collection(db, 'stores', user.uid, 'inventoryMovements'))
          batch.set(movementRef, { productId:refDoc.id, productName:normalized.name || 'Producto', sku:normalized.sku || '', type:'entry', source:'import', reason:'Importación Excel', reference:'Importación de inventario', notes:'', quantity:normalized.stock, balanceBefore:0, balanceAfter:normalized.stock, unitCost:Number(normalized.cost || 0), date:createdAtText.slice(0,10), createdAt:serverTimestamp(), createdAtText })
        }
      })
      await batch.commit()
    }
    e.target.value = ''
    alert(`${rows.length} productos importados.`)
  }

  return <>
    <PageHeader title="Inventario" subtitle="Administra productos, filtra rápidamente y navega por páginas sin perder el control del stock.">
      <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
      <button className="btn ghost" onClick={() => fileRef.current?.click()}><Upload size={17}/> Importar Excel</button>
      <button className="btn ghost" onClick={() => exportProducts(filtered)} disabled={!filtered.length}><Download size={17}/> Exportar filtrados</button>
      <Link className="btn ghost" to="/movimientos"><ArrowLeftRight size={17}/> Entradas y salidas</Link>
      <button className="btn primary" onClick={newProduct}><Plus size={17}/> Producto</button>
    </PageHeader>

    <section className="card product-filter-panel">
      <div className="product-filter-top">
        <div className="search product-search-wide"><Search size={18}/><input placeholder="Buscar nombre, SKU, categoría o descripción…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="filter-summary"><SlidersHorizontal size={16}/><span>{filtered.length} de {products.length} productos</span>{activeFilters > 0 && <b>{activeFilters} filtros</b>}</div>
      </div>
      <div className="product-filter-grid">
        <label><span>Categoría</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">Todas</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>Stock</span><select value={stockFilter} onChange={e => setStockFilter(e.target.value)}><option value="all">Todo el stock</option><option value="available">Disponible</option><option value="low">Stock bajo</option><option value="out">Agotado</option></select></label>
        <label><span>Catálogo</span><select value={visibility} onChange={e => setVisibility(e.target.value)}><option value="all">Todos</option><option value="active">Activos</option><option value="hidden">Ocultos</option></select></label>
        <label><span>Ordenar</span><select value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="name-asc">Nombre A–Z</option><option value="name-desc">Nombre Z–A</option><option value="price-asc">Precio menor</option><option value="price-desc">Precio mayor</option><option value="stock-asc">Stock menor</option><option value="stock-desc">Stock mayor</option><option value="newest">Más recientes</option></select></label>
        <label><span>Precio mínimo</span><input type="number" min="0" step="0.01" placeholder="0" value={minPrice} onChange={e => setMinPrice(e.target.value)}/></label>
        <label><span>Precio máximo</span><input type="number" min="0" step="0.01" placeholder="Sin límite" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}/></label>
        <button className="btn ghost clear-filter-btn" onClick={clearFilters} disabled={!activeFilters && sortBy === 'name-asc'}><FilterX size={16}/> Limpiar filtros</button>
      </div>
    </section>

    <div className="table-card card">
      {paginated.length ? <div className="table-wrap"><table><thead><tr><th>Producto</th><th>SKU</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Estado</th><th></th></tr></thead><tbody>{paginated.map(p => <tr key={p.id}><td><div className="product-cell">{p.imageUrl ? <img src={p.imageUrl} alt=""/> : <div className="image-placeholder">IMG</div>}<div><strong>{p.name}</strong><small>{p.description}</small></div></div></td><td>{p.sku || '—'}</td><td>{p.category || '—'}</td><td>{money(p.price, store?.currency)}</td><td>{money(p.cost, store?.currency)}</td><td><span className={Number(p.stock || 0) <= Number(p.minStock || 0) ? 'badge bad' : 'badge good'}>{p.stock || 0}</span></td><td>{p.active === false ? <span className="badge info">Oculto</span> : <span className="badge good">Activo</span>}</td><td className="row-actions"><button className="icon-btn" onClick={() => edit(p)}><Pencil size={16}/></button><button className="icon-btn danger" onClick={() => remove(p)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div> : <EmptyState title="No hay productos con esos filtros" text="Prueba limpiar los filtros o agrega un producto nuevo." />}
      {filtered.length > 0 && <div className="pagination-bar">
        <div className="pagination-size"><span>Mostrar</span><select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select><span>por página</span></div>
        <div className="pagination-info">Mostrando <strong>{(page - 1) * pageSize + 1}</strong>–<strong>{Math.min(page * pageSize, filtered.length)}</strong> de <strong>{filtered.length}</strong></div>
        <div className="pagination-controls">
          <button onClick={() => setPage(1)} disabled={page === 1} aria-label="Primera página"><ChevronsLeft size={16}/></button>
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page === 1} aria-label="Página anterior"><ChevronLeft size={16}/></button>
          {visiblePages.map(n => <button key={n} className={n === page ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>)}
          <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page === totalPages} aria-label="Página siguiente"><ChevronRight size={16}/></button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Última página"><ChevronsRight size={16}/></button>
        </div>
      </div>}
    </div>

    <Modal open={open} title={editing ? 'Editar producto' : 'Nuevo producto'} onClose={() => setOpen(false)} wide>
      <form onSubmit={save} className="form-grid modal-form">
        <label>Nombre<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label>
        <label>SKU<input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}/></label>
        <label>Categoría<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}/></label>
        <label>Precio de venta<input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}/></label>
        <label>Costo<input type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })}/></label>
        <label>Stock<input type="number" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}/></label>
        <label>Stock mínimo<input type="number" step="1" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })}/></label>
        <label className="span-2">Imagen por URL<input placeholder="https://... (opcional si prefieres pegar un enlace)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}/></label>
        <div className="span-2 product-image-upload product-image-upload-v9">
          <div className="product-image-preview">{form.imageUrl ? <img src={form.imageUrl} alt="Vista previa"/> : <ImagePlus size={30}/>}</div>
          <div className="product-upload-copy">
            <strong>Subir foto desde tu dispositivo</strong>
            <small>La imagen principal se guarda en Firebase Storage para que inventario, POS y catálogo tengan una URL estable.</small>
            <label className="btn ghost upload-label"><ImagePlus size={16}/>{uploading ? 'Subiendo foto…' : 'Elegir foto'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploading} onChange={e => uploadImage(e.target.files?.[0])}/></label>
            <label className="google-photos-option"><input type="checkbox" checked={backupToGooglePhotos} onChange={e => setBackupToGooglePhotos(e.target.checked)}/><span><b>Guardar también en Google Photos</b><small>Opcional. Google pedirá permiso para guardar una copia en la biblioteca de esta cuenta.</small></span></label>
            {form.googlePhotosProductUrl && <a className="photos-saved-link" href={form.googlePhotosProductUrl} target="_blank" rel="noreferrer">Ver copia en Google Photos</a>}
          </div>
        </div>
        {googlePhotosStatus && <div className="span-2 alert info">{googlePhotosStatus}</div>}
        {imageError && <div className="span-2 alert error">{imageError}</div>}
        <label className="span-2">Descripción<textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label>
        <label className="check"><input type="checkbox" checked={form.active !== false} onChange={(e) => setForm({ ...form, active: e.target.checked })}/> Mostrar en catálogo</label>
        <div className="span-2 form-footer"><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="btn primary" disabled={uploading}>Guardar producto</button></div>
      </form>
    </Modal>
  </>
}
