import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { CalendarDays, Plus, Receipt, Trash2, WalletCards } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { money } from '../utils/format'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const today=()=>new Date().toISOString().slice(0,10)
const blank=()=>({title:'',category:'Servicios',amount:'',date:today(),paymentMethod:'Efectivo',notes:''})
const categories=['Servicios','Transporte','Publicidad','Alquiler','Salarios','Impuestos','Mantenimiento','Empaque','Envíos','Otros']

function buildCalendar(month, entries) {
  const [y,m]=month.split('-').map(Number)
  const first=new Date(y,m-1,1)
  const last=new Date(y,m,0)
  const leading=first.getDay()
  const days=[]
  for(let i=0;i<leading;i++) days.push(null)
  for(let d=1;d<=last.getDate();d++){
    const date=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const items=entries.filter(e=>e.date===date)
    days.push({day:d,date,items,total:items.reduce((a,e)=>a+Number(e.amount||e.total||0),0)})
  }
  while(days.length%7) days.push(null)
  return days
}

export default function Expenses(){
  const {user,store}=useAuth()
  const [expenses,setExpenses]=useState([])
  const [purchases,setPurchases]=useState([])
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7))
  const [open,setOpen]=useState(false)
  const [form,setForm]=useState(blank())
  const [saving,setSaving]=useState(false)

  useEffect(()=>{
    if(!user)return
    const a=onSnapshot(collection(db,'stores',user.uid,'expenses'),s=>setExpenses(s.docs.map(d=>({id:d.id,...d.data()}))))
    const b=onSnapshot(collection(db,'stores',user.uid,'purchases'),s=>setPurchases(s.docs.map(d=>({id:d.id,...d.data()}))))
    return()=>{a();b()}
  },[user])

  const monthExpenses=expenses.filter(e=>String(e.date||'').slice(0,7)===month)
  const monthPurchases=purchases.filter(p=>String(p.date||'').slice(0,7)===month)
  const expenseTotal=monthExpenses.reduce((a,e)=>a+Number(e.amount||0),0)
  const purchaseTotal=monthPurchases.reduce((a,p)=>a+Number(p.total||0),0)
  const allEntries=useMemo(()=>[
    ...monthExpenses.map(e=>({...e,kind:'expense'})),
    ...monthPurchases.map(p=>({...p,title:`Compra ${p.number||''}`,category:'Compras',amount:Number(p.total||0),kind:'purchase'})),
  ],[monthExpenses,monthPurchases])
  const calendar=useMemo(()=>buildCalendar(month,allEntries),[month,allEntries])
  const topCategory=useMemo(()=>{
    const map={}
    monthExpenses.forEach(e=>map[e.category||'Otros']=(map[e.category||'Otros']||0)+Number(e.amount||0))
    return Object.entries(map).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'
  },[monthExpenses])

  async function save(e){
    e.preventDefault();setSaving(true)
    try{
      if(!form.title.trim()||Number(form.amount)<=0)throw new Error('Completa el concepto y un monto mayor que cero.')
      await addDoc(collection(db,'stores',user.uid,'expenses'),{...form,title:form.title.trim(),amount:Number(form.amount),createdAt:serverTimestamp(),createdAtText:new Date().toISOString()})
      setForm(blank());setOpen(false)
    }catch(err){alert(err.message)}finally{setSaving(false)}
  }

  async function remove(e){if(confirm(`¿Eliminar el gasto “${e.title}”?`))await deleteDoc(doc(db,'stores',user.uid,'expenses',e.id))}

  return <>
    <PageHeader title="Gastos y calendario" subtitle="Controla egresos operativos y visualiza cuánto gastas cada día del mes.">
      <label className="month-picker"><CalendarDays size={17}/><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
      <button className="btn primary" onClick={()=>setOpen(true)}><Plus size={17}/> Nuevo gasto</button>
    </PageHeader>
    <div className="finance-stats-grid four">
      <article className="card finance-stat red"><span><WalletCards/></span><div><small>Gastos operativos</small><strong>{money(expenseTotal,store?.currency)}</strong><em>{monthExpenses.length} movimientos</em></div></article>
      <article className="card finance-stat purple"><span><Receipt/></span><div><small>Compras de inventario</small><strong>{money(purchaseTotal,store?.currency)}</strong><em>{monthPurchases.length} compras</em></div></article>
      <article className="card finance-stat orange"><span><CalendarDays/></span><div><small>Egresos totales</small><strong>{money(expenseTotal+purchaseTotal,store?.currency)}</strong><em>Compras + gastos</em></div></article>
      <article className="card finance-stat blue"><span><Receipt/></span><div><small>Categoría principal</small><strong className="text-stat">{topCategory}</strong><em>Mayor gasto operativo</em></div></article>
    </div>

    <section className="card expense-calendar-card">
      <div className="card-heading"><div><span className="section-kicker">CALENDARIO FINANCIERO</span><h2>Gastos de {new Date(`${month}-01T12:00:00`).toLocaleDateString('es-NI',{month:'long',year:'numeric'})}</h2></div><div className="calendar-legend"><span><i className="dot-expense"/>Gasto</span><span><i className="dot-purchase"/>Compra</span></div></div>
      <div className="calendar-weekdays">{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d=><span key={d}>{d}</span>)}</div>
      <div className="expense-calendar">{calendar.map((d,i)=>d?<div className={`calendar-day ${d.items.length?'has-items':''}`} key={d.date}><div className="calendar-day-head"><b>{d.day}</b>{d.total>0&&<strong>{money(d.total,store?.currency)}</strong>}</div><div className="calendar-items">{d.items.slice(0,3).map(x=><div className={`calendar-item ${x.kind}`} key={`${x.kind}-${x.id}`} title={x.title}><i/><span>{x.title}</span><b>{money(x.amount||x.total,store?.currency)}</b></div>)}{d.items.length>3&&<small>+{d.items.length-3} más</small>}</div></div>:<div className="calendar-day empty-day" key={`blank-${i}`}/>)}</div>
    </section>

    <section className="card table-card expense-table">{monthExpenses.length?<div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Pago</th><th>Monto</th><th></th></tr></thead><tbody>{monthExpenses.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(e=><tr key={e.id}><td>{new Date(`${e.date}T12:00:00`).toLocaleDateString('es-NI')}</td><td><strong>{e.title}</strong><small className="table-subtext">{e.notes}</small></td><td><span className="badge info">{e.category}</span></td><td>{e.paymentMethod}</td><td><strong>{money(e.amount,store?.currency)}</strong></td><td><button className="icon-btn danger" onClick={()=>remove(e)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>:<EmptyState title="Sin gastos operativos" text="Agrega servicios, transporte, publicidad, alquiler u otros gastos."/>}</section>

    <Modal open={open} title="Registrar gasto" onClose={()=>setOpen(false)}>
      <form className="form-stack modal-form" onSubmit={save}>
        <label>Concepto<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej. Internet del local"/></label>
        <div className="form-grid"><label>Categoría<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Monto<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label>Fecha<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Método de pago<select value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})}><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></label></div>
        <label>Notas<textarea rows="3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        <div className="form-footer"><button type="button" className="btn ghost" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn primary" disabled={saving}>{saving?'Guardando…':'Guardar gasto'}</button></div>
      </form>
    </Modal>
  </>
}
