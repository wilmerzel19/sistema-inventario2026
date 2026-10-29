import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const blank = { name: '', phone: '', whatsapp: '', email: '', address: '', notes: '' }

export default function Customers() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)

  useEffect(() => user ? onSnapshot(collection(db, 'stores', user.uid, 'customers'), snap => {
    setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }) : undefined, [user])

  const filtered = useMemo(() => customers.filter(c => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(search.toLowerCase())), [customers, search])

  function createCustomer() { setEditing(null); setForm(blank); setOpen(true) }
  function editCustomer(c) { setEditing(c); setForm({ ...blank, ...c }); setOpen(true) }

  async function save(e) {
    e.preventDefault()
    const data = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.replace(/\D/g, ''),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      updatedAt: serverTimestamp(),
    }
    if (editing) await updateDoc(doc(db, 'stores', user.uid, 'customers', editing.id), data)
    else await addDoc(collection(db, 'stores', user.uid, 'customers'), { ...data, createdAt: serverTimestamp() })
    setOpen(false)
  }

  async function removeCustomer(c) {
    if (confirm(`¿Eliminar a ${c.name}?`)) await deleteDoc(doc(db, 'stores', user.uid, 'customers', c.id))
  }

  return <>
    <PageHeader title="Clientes" subtitle="Guarda clientes para reutilizarlos rápidamente en facturas y cotizaciones.">
      <button className="btn primary" onClick={createCustomer}><Plus size={17}/> Cliente</button>
    </PageHeader>
    <div className="toolbar card">
      <div className="search"><Search size={18}/><input placeholder="Buscar por nombre, teléfono o correo…" value={search} onChange={e => setSearch(e.target.value)}/></div>
      <span className="muted">{filtered.length} clientes</span>
    </div>
    <div className="card table-card">
      {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Teléfono</th><th>WhatsApp</th><th>Correo</th><th>Dirección</th><th></th></tr></thead><tbody>
        {filtered.map(c => <tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.phone || '—'}</td><td>{c.whatsapp || '—'}</td><td>{c.email || '—'}</td><td>{c.address || '—'}</td><td className="row-actions"><button className="icon-btn" onClick={() => editCustomer(c)}><Pencil size={16}/></button><button className="icon-btn danger" onClick={() => removeCustomer(c)}><Trash2 size={16}/></button></td></tr>)}
      </tbody></table></div> : <EmptyState title="Sin clientes" text="Puedes facturar a consumidor final o guardar clientes frecuentes aquí."/>}
    </div>
    <Modal open={open} title={editing ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setOpen(false)} wide>
      <form onSubmit={save} className="form-grid modal-form">
        <label>Nombre<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
        <label>Teléfono<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></label>
        <label>WhatsApp<input placeholder="50588888888" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })}/></label>
        <label>Correo<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label>
        <label className="span-2">Dirección<input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}/></label>
        <label className="span-2">Notas<textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label>
        <div className="span-2 form-footer"><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="btn primary">Guardar cliente</button></div>
      </form>
    </Modal>
  </>
}
