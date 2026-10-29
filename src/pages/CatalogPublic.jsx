import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { MessageCircle, Search, ShoppingBag } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { db } from '../lib/firebase'
import { money } from '../utils/format'

export default function CatalogPublic() {
  const { slug } = useParams()
  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { (async () => {
    try {
      const stores = await getDocs(query(collection(db, 'stores'), where('slug', '==', slug), where('catalogPublic', '==', true), limit(1)))
      if (stores.empty) return
      const s = { id: stores.docs[0].id, ...stores.docs[0].data() }; setStore(s)
      const ps = await getDocs(collection(db, 'stores', s.id, 'products'))
      setProducts(ps.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.active !== false))
    } finally { setLoading(false) }
  })() }, [slug])

  const filtered = useMemo(() => products.filter(p => `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(search.toLowerCase())), [products, search])
  if (loading) return <div className="center-page">Cargando catálogo…</div>
  if (!store) return <div className="center-page"><div><h1>Catálogo no disponible</h1><p>Revisa el enlace o consulta con la tienda.</p></div></div>

  return <div className="catalog" style={{ '--accent': store.accentColor || '#2563eb' }}>
    <header className="catalog-head"><div className="catalog-brand">{store.logoUrl ? <img src={store.logoUrl} alt={store.name}/> : <div className="catalog-logo"><ShoppingBag/></div>}<div><h1>{store.name}</h1><p>{store.address || 'Catálogo de productos'}</p></div></div>{store.whatsapp && <a className="catalog-contact" href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={18}/> WhatsApp</a>}</header>
    <main className="catalog-main"><div className="catalog-search"><Search size={19}/><input placeholder="Buscar productos…" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="catalog-grid">{filtered.map(p => <article className="product-card" key={p.id}><div className="product-photo">{p.imageUrl ? <img src={p.imageUrl} alt={p.name}/> : <ShoppingBag size={36}/>}</div><div className="product-body"><small>{p.category || 'Producto'}</small><h2>{p.name}</h2><p>{p.description}</p><div className="product-bottom"><strong>{money(p.price, store.currency)}</strong>{store.whatsapp && <a href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(`Hola, me interesa ${p.name} del catálogo de ${store.name}.`)}`} target="_blank" rel="noreferrer">Pedir</a>}</div></div></article>)}</div>{!filtered.length && <div className="empty"><strong>No encontramos productos</strong><p>Prueba con otra búsqueda.</p></div>}</main>
    <footer>Catálogo de {store.name}</footer>
  </div>
}
