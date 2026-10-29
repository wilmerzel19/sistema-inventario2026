import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import {
  Check, Copy, Download, ExternalLink, ImageDown, LayoutTemplate,
  Palette, Share2, Sparkles, Type
} from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { money } from '../utils/format'
import PageHeader from '../components/PageHeader'

const templates = [
  { id: 'brand', name: 'Marca PRO', subtitle: 'Limpio y comercial' },
  { id: 'bold', name: 'Impacto', subtitle: 'Precio protagonista' },
  { id: 'gradient', name: 'Gradient', subtitle: 'Moderno y digital' },
  { id: 'minimal', name: 'Minimal', subtitle: 'Premium y limpio' },
  { id: 'dark', name: 'Night', subtitle: 'Oscuro elegante' },
  { id: 'flash', name: 'Flash Sale', subtitle: 'Promoción intensa' },
  { id: 'neon', name: 'Neon Tech', subtitle: 'Brillante y juvenil' },
  { id: 'luxury', name: 'Luxury', subtitle: 'Negro y dorado premium' },
  { id: 'fresh', name: 'Fresh', subtitle: 'Claro, fresco y natural' },
  { id: 'pastel', name: 'Pastel Pop', subtitle: 'Suave y moderno' },
  { id: 'split', name: 'Split Ad', subtitle: 'Comercial en dos bloques' },
  { id: 'frame', name: 'Editorial', subtitle: 'Marco elegante de catálogo' },
]

const formats = {
  square: { label: 'Post 1:1', width: 1080, height: 1080, hint: 'Instagram / Facebook' },
  portrait: { label: 'Post 4:5', width: 1080, height: 1350, hint: 'Feed vertical' },
  story: { label: 'Historia 9:16', width: 1080, height: 1920, hint: 'Stories / Reels' },
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function rr(ctx, x, y, width, height, radius) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.closePath()
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || '').split(/\s+/)
  let line = ''; let lines = 0
  for (let i = 0; i < words.length; i++) {
    const test = `${line}${words[i]} `
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, y + lines * lineHeight); lines += 1; line = `${words[i]} `
      if (lines >= maxLines) return
    } else line = test
  }
  if (line && lines < maxLines) ctx.fillText(line.trim(), x, y + lines * lineHeight)
}

function drawContained(ctx, img, box, cover = false) {
  if (!img) return false
  const scale = cover ? Math.max(box.w / img.width, box.h / img.height) : Math.min(box.w / img.width, box.h / img.height)
  const w = img.width * scale; const h = img.height * scale
  ctx.save(); rr(ctx, box.x, box.y, box.w, box.h, box.r || 28); ctx.clip()
  ctx.drawImage(img, box.x + (box.w-w)/2, box.y + (box.h-h)/2, w, h)
  ctx.restore(); return true
}

function readableText(hex = '#2563eb') {
  const value = hex.replace('#','')
  if (value.length !== 6) return '#ffffff'
  const [r,g,b] = [0,2,4].map(i => parseInt(value.slice(i,i+2),16))
  return ((r*299 + g*587 + b*114)/1000) > 160 ? '#0f172a' : '#ffffff'
}

export default function Marketing() {
  const { user, store } = useAuth()
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [tone, setTone] = useState('venta')
  const [custom, setCustom] = useState('')
  const [headline, setHeadline] = useState('')
  const [template, setTemplate] = useState('brand')
  const [format, setFormat] = useState('square')
  const [promoPrice, setPromoPrice] = useState('')
  const [badge, setBadge] = useState('')
  const [cta, setCta] = useState('Comprar ahora')
  const [busy, setBusy] = useState(false)

  useEffect(() => user ? onSnapshot(collection(db, 'stores', user.uid, 'products'), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })))) : undefined, [user])
  const p = products.find(x => x.id === productId)
  const catalogUrl = `${window.location.origin}/catalogo/${store?.slug || ''}`
  const accent = store?.accentColor || '#2563eb'
  const toneHeadline = tone === 'urgencia' ? '¡ÚLTIMAS UNIDADES!' : tone === 'nuevo' ? 'NUEVO PRODUCTO' : tone === 'oferta' ? 'OFERTA ESPECIAL' : tone === 'temporada' ? 'PROMO DE TEMPORADA' : 'DISPONIBLE AHORA'
  const finalHeadline = headline.trim() || toneHeadline
  const displayPrice = promoPrice !== '' ? Number(promoPrice) : Number(p?.price || 0)

  const caption = useMemo(() => {
    if (!p) return 'Selecciona un producto para crear una publicación.'
    const price = money(displayPrice, store?.currency)
    const intro = tone === 'urgencia' ? `🔥 ¡Últimas unidades de ${p.name}!` : tone === 'nuevo' ? `✨ Llegó algo nuevo a ${store?.name || 'nuestra tienda'}: ${p.name}` : tone === 'oferta' ? `🏷️ Oferta especial en ${p.name}` : tone === 'temporada' ? `🎉 Promo de temporada: ${p.name}` : `🛍️ ${p.name} disponible en ${store?.name || 'nuestra tienda'}`
    const desc = p.description ? `\n${p.description}` : ''
    const call = store?.whatsapp ? `\n📲 Pídelo por WhatsApp: https://wa.me/${store.whatsapp}` : ''
    const priceLine = promoPrice !== '' && Number(p.price || 0) !== displayPrice ? `\n💥 Antes: ${money(p.price, store?.currency)} | Ahora: ${price}` : `\n💰 Precio: ${price}`
    return `${intro}${desc}${priceLine}${custom ? `\n${custom}` : ''}${call}\n🔗 Catálogo: ${catalogUrl}\n\n#${(store?.name || 'MiTienda').replace(/\s+/g,'')} #Promoción #CompraLocal`
  }, [p, tone, custom, store, catalogUrl, displayPrice, promoPrice])

  async function share() {
    if (!p) return
    if (navigator.share) await navigator.share({ title: p.name, text: caption, url: catalogUrl })
    else { await navigator.clipboard.writeText(caption); alert('Texto copiado. Pégalo en tu red social.') }
  }

  async function downloadPost() {
    if (!p) return alert('Selecciona un producto primero.')
    setBusy(true)
    try {
      const size = formats[format]
      const canvas = document.createElement('canvas')
      canvas.width = size.width; canvas.height = size.height
      const ctx = canvas.getContext('2d')
      const W = canvas.width; const H = canvas.height
      const pad = 64
      const textOnAccent = readableText(accent)
      let productImg = null; let logoImg = null
      try { productImg = await loadImage(p.imageUrl) } catch { productImg = null }
      try { logoImg = await loadImage(store?.logoUrl) } catch { logoImg = null }

      const topH = Math.round(H * (format === 'story' ? .17 : .19))
      const imageY = topH + 42
      const imageH = Math.round(H * (format === 'story' ? .48 : .43))
      const bottomY = imageY + imageH + 42

      if (template === 'gradient') {
        const g = ctx.createLinearGradient(0,0,W,H); g.addColorStop(0, accent); g.addColorStop(1, '#0f172a'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H)
      } else if (template === 'dark') {
        ctx.fillStyle='#0b1120'; ctx.fillRect(0,0,W,H); ctx.fillStyle=accent; ctx.globalAlpha=.22; ctx.beginPath(); ctx.arc(W*.85,H*.12,W*.38,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1
      } else if (template === 'neon') {
        ctx.fillStyle='#050816';ctx.fillRect(0,0,W,H)
        const ng=ctx.createRadialGradient(W*.82,H*.18,20,W*.82,H*.18,W*.55);ng.addColorStop(0,accent);ng.addColorStop(1,'rgba(5,8,22,0)');ctx.fillStyle=ng;ctx.globalAlpha=.34;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1
        ctx.strokeStyle=accent;ctx.globalAlpha=.24;ctx.lineWidth=3;for(let x=-H;x<W+H;x+=95){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-H,H);ctx.stroke()}ctx.globalAlpha=1
      } else if (template === 'luxury') {
        ctx.fillStyle='#0b0b0c';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#c9a34a';ctx.lineWidth=7;ctx.strokeRect(34,34,W-68,H-68);ctx.strokeStyle='rgba(201,163,74,.35)';ctx.lineWidth=2;ctx.strokeRect(50,50,W-100,H-100)
      } else if (template === 'fresh') {
        const fg=ctx.createLinearGradient(0,0,W,H);fg.addColorStop(0,'#ecfeff');fg.addColorStop(1,'#f0fdf4');ctx.fillStyle=fg;ctx.fillRect(0,0,W,H);ctx.fillStyle=accent;ctx.globalAlpha=.12;ctx.beginPath();ctx.arc(W*.88,H*.15,W*.26,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(W*.08,H*.82,W*.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1
      } else if (template === 'pastel') {
        ctx.fillStyle='#fff7fb';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fce7f3';ctx.beginPath();ctx.arc(W*.84,H*.16,W*.28,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ede9fe';ctx.beginPath();ctx.arc(W*.05,H*.72,W*.24,0,Math.PI*2);ctx.fill()
      } else if (template === 'split') {
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,0);ctx.lineTo(W,H*.22);ctx.lineTo(0,H*.31);ctx.closePath();ctx.fill()
      } else if (template === 'frame') {
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);ctx.strokeStyle=accent;ctx.lineWidth=18;ctx.strokeRect(26,26,W-52,H-52);ctx.strokeStyle='#0f172a';ctx.lineWidth=2;ctx.strokeRect(52,52,W-104,H-104)
      } else if (template === 'flash') {
        ctx.fillStyle='#fff7ed';ctx.fillRect(0,0,W,H);ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,0);ctx.lineTo(W,H*.26);ctx.lineTo(0,H*.18);ctx.closePath();ctx.fill()
      } else if (template === 'bold') {
        ctx.fillStyle=accent;ctx.fillRect(0,0,W,H)
      } else {
        ctx.fillStyle=template === 'minimal' ? '#ffffff' : '#f5f7fb';ctx.fillRect(0,0,W,H)
      }

      const darkTemplate = ['gradient','dark','bold','neon','luxury'].includes(template)
      const headerOnAccent = ['flash','split'].includes(template)
      const premiumAccent = template === 'luxury' ? '#c9a34a' : accent

      if (template === 'minimal') {
        ctx.fillStyle=accent;ctx.fillRect(0,0,18,H)
        ctx.fillStyle='#0f172a';ctx.font='800 24px Arial';ctx.fillText((store?.name || 'MI TIENDA').toUpperCase(),pad,76)
        ctx.fillStyle=accent;ctx.fillRect(pad,100,110,7)
      } else {
        if (logoImg) drawContained(ctx, logoImg, {x:pad,y:52,w:100,h:100,r:25}, true)
        else { ctx.fillStyle=darkTemplate?'rgba(255,255,255,.94)':'#ffffff';rr(ctx,pad,52,100,100,25);ctx.fill();ctx.fillStyle=accent;ctx.textAlign='center';ctx.font='800 36px Arial';ctx.fillText((store?.name||'T')[0].toUpperCase(),pad+50,116);ctx.textAlign='left' }
        ctx.fillStyle = headerOnAccent ? textOnAccent : darkTemplate ? (template === 'luxury' ? '#f8e7b0' : '#ffffff') : '#0f172a'
        ctx.font='800 32px Arial';ctx.fillText(store?.name || 'Mi Tienda',190,93)
        ctx.font='700 21px Arial';ctx.globalAlpha=.84;ctx.fillText(finalHeadline,190,130);ctx.globalAlpha=1
      }

      if (badge.trim()) {
        ctx.font='800 20px Arial'; const bw=Math.min(390,ctx.measureText(badge.toUpperCase()).width+46)
        ctx.fillStyle = template === 'flash' ? '#0f172a' : premiumAccent; rr(ctx,W-pad-bw,66,bw,54,27);ctx.fill();ctx.fillStyle=template === 'luxury' ? '#111111' : '#fff';ctx.textAlign='center';ctx.fillText(badge.toUpperCase(),W-pad-bw/2,101);ctx.textAlign='left'
      }

      let imageBox = {x:pad,y:imageY,w:W-pad*2,h:imageH,r:34}
      if (template === 'minimal') imageBox={x:pad,y:Math.max(150,imageY-40),w:W-pad*2,h:imageH,r:10}
      ctx.fillStyle = template === 'bold' ? '#ffffff' : ['dark','neon','luxury'].includes(template) ? '#111827' : ['fresh','pastel','split','frame'].includes(template) ? '#ffffff' : '#eef2f7'; rr(ctx,imageBox.x,imageBox.y,imageBox.w,imageBox.h,imageBox.r);ctx.fill()
      if (!drawContained(ctx,productImg,imageBox,template==='flash')) {ctx.fillStyle='#94a3b8';ctx.textAlign='center';ctx.font='700 28px Arial';ctx.fillText('Imagen del producto',W/2,imageBox.y+imageBox.h/2);ctx.textAlign='left'}

      if (template === 'bold') {
        ctx.fillStyle='#ffffff';rr(ctx,pad,bottomY-12,W-pad*2,H-bottomY-pad+12,34);ctx.fill()
      }

      const contentColor = darkTemplate && template!=='bold' ? '#ffffff' : '#0f172a'
      ctx.fillStyle=contentColor;ctx.font=`800 ${format==='story'?58:50}px Arial`;wrapText(ctx,p.name,pad,bottomY+48,W-pad*2-300,format==='story'?68:58,2)
      const descY = bottomY + (format==='story'?190:158)
      ctx.fillStyle=darkTemplate && template!=='bold' ? '#cbd5e1' : '#64748b';ctx.font=`500 ${format==='story'?29:25}px Arial`;wrapText(ctx,custom || p.description || 'Disponible en nuestro catálogo.',pad,descY,W-pad*2-300,38,3)

      const priceW=270, priceH=110, priceX=W-pad-priceW, priceY=bottomY+20
      ctx.fillStyle = template==='flash' ? '#0f172a' : premiumAccent;rr(ctx,priceX,priceY,priceW,priceH,28);ctx.fill();ctx.fillStyle=template==='flash'?'#fff':template==='luxury'?'#111111':textOnAccent;ctx.textAlign='center';ctx.font='800 36px Arial';ctx.fillText(money(displayPrice,store?.currency),priceX+priceW/2,priceY+66);ctx.textAlign='left'

      if (promoPrice !== '' && Number(p.price || 0) !== displayPrice) {
        ctx.fillStyle=darkTemplate && template!=='bold'?'#94a3b8':'#94a3b8';ctx.font='600 22px Arial';ctx.fillText(`Antes ${money(p.price,store?.currency)}`,priceX+28,priceY+145)
        ctx.strokeStyle='#ef4444';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(priceX+24,priceY+137);ctx.lineTo(priceX+priceW-24,priceY+137);ctx.stroke()
      }

      const ctaY=H-pad-76
      ctx.fillStyle = ['minimal','fresh','pastel','frame'].includes(template) ? premiumAccent : darkTemplate ? 'rgba(255,255,255,.14)' : '#e9eef7'; rr(ctx,pad,ctaY,W-pad*2,76,22);ctx.fill()
      ctx.fillStyle = ['minimal','fresh','pastel','frame'].includes(template) ? (template==='luxury'?'#111111':textOnAccent) : darkTemplate ? '#ffffff' : '#334155';ctx.font='800 23px Arial';ctx.fillText((cta||'Comprar ahora').toUpperCase(),pad+28,ctaY+47)
      ctx.textAlign='right';ctx.font='600 19px Arial';ctx.fillText(store?.whatsapp ? `WhatsApp ${store.whatsapp}` : 'Mira nuestro catálogo',W-pad-28,ctaY+47);ctx.textAlign='left'

      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png',1))
      if (!blob) throw new Error('No se pudo generar la imagen.')
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${p.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-${template}-${format}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)
    } catch (err) { alert(`No se pudo crear la pieza: ${err.message}`) } finally { setBusy(false) }
  }

  return <>
    <PageHeader title="Marketing Studio" subtitle="Convierte tus productos en promociones listas para redes sociales." />

    <div className="marketing-toolbar card">
      <div className="marketing-step"><span>1</span><div><strong>Producto</strong><small>Elige qué vas a promocionar</small></div></div>
      <div className="marketing-step"><span>2</span><div><strong>Diseño</strong><small>Escoge plantilla y formato</small></div></div>
      <div className="marketing-step"><span>3</span><div><strong>Publica</strong><small>Descarga o comparte</small></div></div>
    </div>

    <div className="marketing-studio-grid">
      <section className="card marketing-controls">
        <div className="control-section"><div className="control-title"><Sparkles size={18}/><div><strong>Contenido</strong><small>Información principal de la promoción</small></div></div>
          <div className="form-stack compact">
            <label>Producto<select value={productId} onChange={e=>{setProductId(e.target.value);setPromoPrice('')}}><option value="">Selecciona un producto…</option>{products.filter(p=>p.active!==false).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <div className="form-grid"><label>Tipo de campaña<select value={tone} onChange={e=>setTone(e.target.value)}><option value="venta">Venta directa</option><option value="nuevo">Nuevo producto</option><option value="oferta">Oferta especial</option><option value="urgencia">Últimas unidades</option><option value="temporada">Temporada</option></select></label><label>Precio promocional<input type="number" min="0" step="0.01" placeholder={p?.price ?? '0.00'} value={promoPrice} onChange={e=>setPromoPrice(e.target.value)}/></label></div>
            <label>Título principal<input placeholder={toneHeadline} value={headline} onChange={e=>setHeadline(e.target.value)}/></label>
            <div className="form-grid"><label>Etiqueta / badge<input placeholder="Ej: -20%, NUEVO, 2x1" value={badge} onChange={e=>setBadge(e.target.value)}/></label><label>Botón / CTA<input placeholder="Comprar ahora" value={cta} onChange={e=>setCta(e.target.value)}/></label></div>
            <label>Mensaje adicional<textarea rows="3" placeholder="Envíos, ubicación, promoción, beneficios…" value={custom} onChange={e=>setCustom(e.target.value)}/></label>
          </div>
        </div>

        <div className="control-section"><div className="control-title"><LayoutTemplate size={18}/><div><strong>Plantilla</strong><small>Doce estilos listos para usar</small></div></div>
          <div className="template-grid">{templates.map(t=><button type="button" key={t.id} onClick={()=>setTemplate(t.id)} className={`template-option ${template===t.id?'selected':''}`}><span className={`template-thumb ${t.id}`}><i/><b/><em/></span><div><strong>{t.name}</strong><small>{t.subtitle}</small></div>{template===t.id&&<Check className="template-check" size={16}/>}</button>)}</div>
        </div>

        <div className="control-section"><div className="control-title"><Palette size={18}/><div><strong>Formato</strong><small>Optimizado para cada red social</small></div></div>
          <div className="format-grid">{Object.entries(formats).map(([id,f])=><button type="button" onClick={()=>setFormat(id)} className={`format-option ${format===id?'selected':''}`} key={id}><span className={`format-shape ${id}`}/><div><strong>{f.label}</strong><small>{f.hint}</small></div></button>)}</div>
        </div>
      </section>

      <section className="marketing-preview-column">
        <div className="card preview-shell">
          <div className="preview-head"><div><span className="live-dot"/><strong>Vista previa</strong></div><small>{formats[format].width} × {formats[format].height}px</small></div>
          <div className={`creative-stage ${format}`}>
            <div className={`creative-preview template-${template}`} style={{'--preview-accent':accent}}>
              <div className="creative-deco"/>
              <div className="creative-brand"><span className="creative-logo">{store?.logoUrl?<img src={store.logoUrl} alt=""/>:(store?.name||'T')[0]}</span><div><strong>{store?.name||'Mi Tienda'}</strong><small>{finalHeadline}</small></div></div>
              {badge&&<span className="creative-badge">{badge}</span>}
              <div className="creative-image">{p?.imageUrl?<img src={p.imageUrl} alt={p.name}/>:<div><ImageDown/><span>Selecciona un producto</span></div>}</div>
              <div className="creative-copy"><div><h3>{p?.name||'Tu producto aquí'}</h3><p>{custom||p?.description||'Agrega una descripción atractiva para tu promoción.'}</p></div>{p&&<div className="creative-price">{promoPrice!==''&&Number(p.price)!==displayPrice&&<del>{money(p.price,store?.currency)}</del>}<strong>{money(displayPrice,store?.currency)}</strong></div>}</div>
              <div className="creative-cta"><strong>{cta||'Comprar ahora'}</strong><span>{store?.whatsapp?'WhatsApp disponible':'Ver catálogo'}</span></div>
            </div>
          </div>
          <div className="preview-actions"><button className="btn primary marketing-download" onClick={downloadPost} disabled={!p||busy}><Download size={17}/>{busy?'Generando…':'Descargar diseño PNG'}</button><button className="btn ghost" onClick={share} disabled={!p}><Share2 size={17}/> Compartir</button></div>
        </div>

        <div className="card caption-card">
          <div className="card-heading"><div className="control-title"><Type size={18}/><div><strong>Copy para la publicación</strong><small>Texto listo para acompañar el diseño</small></div></div><button className="btn ghost small" disabled={!p} onClick={()=>navigator.clipboard.writeText(caption)}><Copy size={16}/> Copiar</button></div>
          <div className="post-preview">{caption}</div>
          <div className="social-shortcuts"><button className="btn ghost" onClick={share} disabled={!p}><Share2 size={16}/> Compartir</button><a className="btn ghost" href={`https://wa.me/?text=${encodeURIComponent(caption)}`} target="_blank" rel="noreferrer"><ExternalLink size={16}/> WhatsApp</a><button className="btn ghost" onClick={downloadPost} disabled={!p||busy}><ImageDown size={16}/> Generar PNG</button></div>
        </div>
      </section>
    </div>
  </>
}
