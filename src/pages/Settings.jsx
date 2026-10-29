import { useEffect, useMemo, useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { Building2, CheckCircle2, Copy, ExternalLink, Image, Save, UploadCloud } from 'lucide-react'
import { db, storage } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { slugify } from '../utils/format'
import PageHeader from '../components/PageHeader'

const defaults = {
  name: 'Mi Tienda', legalName: '', slogan: '', slug: '', logoUrl: '', email: '', taxId: '', phone: '', whatsapp: '', address: '',
  currency: 'USD', taxLabel: 'IVA', taxRate: 0, accentColor: '#6366f1', catalogPublic: true,
}

export default function Settings() {
  const { user, store, reloadStore } = useAuth()
  const [form, setForm] = useState(defaults)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => setForm({ ...defaults, ...(store || {}) }), [store])

  const catalogUrl = useMemo(() => `${window.location.origin}/catalogo/${slugify(form.slug || form.name || 'mi-tienda')}`, [form.slug, form.name])

  async function uploadLogo(file) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) return setError('Selecciona un archivo de imagen válido.')
    if (file.size > 4 * 1024 * 1024) return setError('El logo no debe superar 4 MB.')
    setUploading(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const storageRef = ref(storage, `stores/${user.uid}/branding/logo-${Date.now()}-${safeName}`)
      await uploadBytes(storageRef, file, { contentType: file.type })
      const url = await getDownloadURL(storageRef)
      setForm(prev => ({ ...prev, logoUrl: url }))
      setStatus('Logo subido. Pulsa “Guardar cambios” para aplicarlo a toda la tienda.')
    } catch (err) {
      console.error(err)
      setError('No se pudo subir el logo. Verifica VITE_FIREBASE_STORAGE_BUCKET y que Firebase Storage esté habilitado. También puedes pegar una URL directa.')
    } finally {
      setUploading(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true); setError(''); setStatus('Guardando…')
    try {
      const clean = {
        ownerUid: user.uid,
        name: (form.name || 'Mi Tienda').trim(),
        legalName: (form.legalName || '').trim(),
        slogan: (form.slogan || '').trim(),
        slug: slugify(form.slug || form.name || `tienda-${user.uid.slice(0, 6)}`),
        logoUrl: (form.logoUrl || '').trim(),
        email: (form.email || '').trim(),
        taxId: (form.taxId || '').trim(),
        phone: (form.phone || '').trim(),
        whatsapp: (form.whatsapp || '').replace(/\D/g, ''),
        address: (form.address || '').trim(),
        currency: form.currency || 'USD',
        taxLabel: (form.taxLabel || 'IVA').trim(),
        taxRate: Math.max(0, Number(form.taxRate || 0)),
        accentColor: form.accentColor || '#6366f1',
        catalogPublic: Boolean(form.catalogPublic),
        updatedAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'stores', user.uid), clean, { merge: true })
      await reloadStore()
      setStatus('Configuración guardada correctamente.')
    } catch (err) {
      console.error(err)
      setStatus('')
      setError(`No se pudo guardar: ${err?.message || 'error desconocido'}`)
    } finally { setSaving(false) }
  }

  return <>
    <PageHeader title="Configuración de la tienda" subtitle="Tu nombre, logo y datos comerciales se usan en el panel, catálogo, facturas, POS y publicaciones." />

    <div className="settings-layout">
      <section className="card brand-preview-card" style={{ '--store-accent': form.accentColor || '#6366f1' }}>
        <div className="brand-preview-cover" />
        <div className="brand-preview-logo">
          {form.logoUrl ? <img key={form.logoUrl} src={form.logoUrl} alt="Logo de la tienda" /> : <Building2 size={34}/>} 
        </div>
        <h2>{form.name || 'Mi Tienda'}</h2>
        <p>{form.slogan || 'Tu negocio, tu identidad.'}</p>
        <div className="brand-preview-meta"><span>{form.phone || 'Teléfono'}</span><span>{form.address || 'Dirección'}</span></div>
      </section>

      <form className="card form-grid settings-form" onSubmit={save}>
        <div className="span-2 settings-section-title"><strong>Identidad del negocio</strong><small>Estos datos aparecerán en distintas áreas del sistema.</small></div>
        <label>Nombre de la tienda<input required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Razón social / nombre legal<input value={form.legalName || ''} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></label>
        <label className="span-2">Eslogan<input placeholder="Ej. Calidad que inspira" value={form.slogan || ''} onChange={(e) => setForm({ ...form, slogan: e.target.value })} /></label>

        <div className="span-2 logo-uploader">
          <div className="logo-uploader-preview">{form.logoUrl ? <img src={form.logoUrl} alt="Vista previa"/> : <Image size={30}/>}</div>
          <div className="logo-uploader-copy"><strong>Logo de la tienda</strong><small>Sube PNG/JPG/WebP. Se guarda en Firebase Storage y en Firestore solo se guarda el enlace.</small>
            <div className="button-row"><label className="btn ghost upload-label"><UploadCloud size={17}/>{uploading ? 'Subiendo…' : 'Subir logo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploading} onChange={(e) => uploadLogo(e.target.files?.[0])}/></label></div>
          </div>
        </div>
        <label className="span-2">O pega una URL del logo<input placeholder="https://.../logo.png" value={form.logoUrl || ''} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} /></label>

        <div className="span-2 settings-section-title"><strong>Datos de contacto y facturación</strong><small>Úsalos para documentos y atención al cliente.</small></div>
        <label>Correo del negocio<input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>RUC / identificación fiscal<input value={form.taxId || ''} onChange={(e) => setForm({ ...form, taxId: e.target.value })} /></label>
        <label>Teléfono<input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>WhatsApp con código de país<input placeholder="50588888888" value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, '') })} /></label>
        <label className="span-2">Dirección<input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>

        <div className="span-2 settings-section-title"><strong>Operación y catálogo</strong><small>Moneda, impuestos y enlace público.</small></div>
        <label>Moneda<select value={form.currency || 'USD'} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option>USD</option><option>NIO</option><option>EUR</option><option>MXN</option><option>COP</option></select></label>
        <label>Color principal<input type="color" value={form.accentColor || '#6366f1'} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} /></label>
        <label>Nombre del impuesto<input value={form.taxLabel || 'IVA'} onChange={(e) => setForm({ ...form, taxLabel: e.target.value })} /></label>
        <label>Impuesto (%)<input type="number" step="0.01" min="0" value={form.taxRate ?? 0} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} /></label>
        <label className="span-2">Slug del catálogo<input value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="mi-tienda" /></label>
        <label className="check span-2"><input type="checkbox" checked={Boolean(form.catalogPublic)} onChange={(e) => setForm({ ...form, catalogPublic: e.target.checked })} /> Catálogo público habilitado</label>

        <div className="span-2"><div className="share-box"><span>{catalogUrl}</span><button type="button" className="btn ghost" onClick={() => navigator.clipboard.writeText(catalogUrl)}><Copy size={17}/> Copiar</button><a className="btn ghost" href={catalogUrl} target="_blank" rel="noreferrer"><ExternalLink size={17}/> Abrir</a></div></div>
        {error && <div className="span-2 alert error">{error}</div>}
        {status && <div className="span-2 alert success"><CheckCircle2 size={16}/>{status}</div>}
        <div className="span-2 form-footer"><button className="btn primary" disabled={saving || uploading}><Save size={18}/>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </form>
    </div>
  </>
}
