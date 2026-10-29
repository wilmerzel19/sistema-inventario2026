import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { ArrowDownRight, ArrowUpRight, CalendarDays, CircleDollarSign, PiggyBank, ShoppingBag, WalletCards } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { money } from '../utils/format'
import PageHeader from '../components/PageHeader'

const monthLabel = key => new Date(`${key}-01T12:00:00`).toLocaleDateString('es-NI',{month:'short'})
const safeDate = v => { const d=new Date(v||0); return Number.isNaN(d.getTime())?new Date(0):d }

export default function Finance(){
  const {user,store}=useAuth()
  const [sales,setSales]=useState([])
  const [documents,setDocuments]=useState([])
  const [purchases,setPurchases]=useState([])
  const [expenses,setExpenses]=useState([])
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7))

  useEffect(()=>{
    if(!user)return
    const unsubs=[
      onSnapshot(collection(db,'stores',user.uid,'sales'),s=>setSales(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db,'stores',user.uid,'documents'),s=>setDocuments(s.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.type==='invoice'))),
      onSnapshot(collection(db,'stores',user.uid,'purchases'),s=>setPurchases(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db,'stores',user.uid,'expenses'),s=>setExpenses(s.docs.map(d=>({id:d.id,...d.data()})))),
    ]
    return()=>unsubs.forEach(x=>x())
  },[user])

  const unifiedSales=useMemo(()=>{
    const map=new Map(); sales.forEach(s=>map.set(s.number||s.id,s)); documents.forEach(d=>{if(!map.has(d.number))map.set(d.number,{...d,source:'invoice'})}); return [...map.values()]
  },[sales,documents])

  const summary=useMemo(()=>{
    const mSales=unifiedSales.filter(s=>String(s.createdAtText||'').slice(0,7)===month)
    const mPurchases=purchases.filter(p=>String(p.date||p.createdAtText||'').slice(0,7)===month)
    const mExpenses=expenses.filter(e=>String(e.date||e.createdAtText||'').slice(0,7)===month)
    const income=mSales.reduce((a,s)=>a+Number(s.total||0),0)
    const purchaseOut=mPurchases.reduce((a,p)=>a+Number(p.total||0),0)
    const expenseOut=mExpenses.reduce((a,e)=>a+Number(e.amount||0),0)
    return {income,purchaseOut,expenseOut,balance:income-purchaseOut-expenseOut,sales:mSales,purchases:mPurchases,expenses:mExpenses}
  },[unifiedSales,purchases,expenses,month])

  const history=useMemo(()=>{
    const [y,m]=month.split('-').map(Number)
    return Array.from({length:6},(_,i)=>{
      const d=new Date(y,m-1-(5-i),1)
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const income=unifiedSales.filter(s=>String(s.createdAtText||'').slice(0,7)===key).reduce((a,s)=>a+Number(s.total||0),0)
      const p=purchases.filter(x=>String(x.date||x.createdAtText||'').slice(0,7)===key).reduce((a,x)=>a+Number(x.total||0),0)
      const e=expenses.filter(x=>String(x.date||x.createdAtText||'').slice(0,7)===key).reduce((a,x)=>a+Number(x.amount||0),0)
      return {key,label:monthLabel(key),income,out:p+e,balance:income-p-e}
    })
  },[month,unifiedSales,purchases,expenses])
  const max=Math.max(...history.flatMap(x=>[x.income,x.out]),1)

  const movements=useMemo(()=>[
    ...summary.sales.map(x=>({id:`s-${x.id||x.number}`,date:x.createdAtText,title:`Venta ${x.number||''}`,type:'income',amount:Number(x.total||0)})),
    ...summary.purchases.map(x=>({id:`p-${x.id}`,date:x.createdAtText||`${x.date}T12:00:00`,title:`Compra ${x.number||''}`,type:'purchase',amount:Number(x.total||0)})),
    ...summary.expenses.map(x=>({id:`e-${x.id}`,date:x.createdAtText||`${x.date}T12:00:00`,title:x.title,type:'expense',amount:Number(x.amount||0)})),
  ].sort((a,b)=>safeDate(b.date)-safeDate(a.date)).slice(0,12),[summary])

  return <>
    <PageHeader title="Panel financiero" subtitle="Ingresos, compras, gastos y balance neto en un solo lugar.">
      <label className="month-picker"><CalendarDays size={17}/><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
    </PageHeader>
    <div className="finance-stats-grid four">
      <article className="card finance-stat green"><span><ArrowUpRight/></span><div><small>Ingresos</small><strong>{money(summary.income,store?.currency)}</strong><em>{summary.sales.length} ventas</em></div></article>
      <article className="card finance-stat purple"><span><ShoppingBag/></span><div><small>Compras</small><strong>{money(summary.purchaseOut,store?.currency)}</strong><em>Reposición de inventario</em></div></article>
      <article className="card finance-stat red"><span><ArrowDownRight/></span><div><small>Gastos</small><strong>{money(summary.expenseOut,store?.currency)}</strong><em>Gastos operativos</em></div></article>
      <article className={`card finance-stat ${summary.balance>=0?'blue':'red'}`}><span><PiggyBank/></span><div><small>Balance</small><strong>{money(summary.balance,store?.currency)}</strong><em>Ingresos − compras − gastos</em></div></article>
    </div>

    <div className="finance-layout">
      <section className="card finance-chart-card"><div className="card-heading"><div><span className="section-kicker">ÚLTIMOS 6 MESES</span><h2>Ingresos vs egresos</h2></div></div><div className="finance-bars">{history.map(x=><div className="finance-bar-group" key={x.key}><div className="finance-bar-values"><i className="income-bar" style={{height:`${Math.max(3,x.income/max*100)}%`}} title={`Ingresos ${money(x.income,store?.currency)}`}/><i className="out-bar" style={{height:`${Math.max(3,x.out/max*100)}%`}} title={`Egresos ${money(x.out,store?.currency)}`}/></div><span>{x.label}</span></div>)}</div><div className="finance-chart-legend"><span><i className="income-dot"/>Ingresos</span><span><i className="out-dot"/>Egresos</span></div></section>
      <section className="card finance-breakdown"><div className="card-heading"><div><span className="section-kicker">DISTRIBUCIÓN</span><h2>¿Dónde está el dinero?</h2></div></div><div className="breakdown-list"><div><span><CircleDollarSign/>Ingresos</span><strong>{money(summary.income,store?.currency)}</strong></div><div><span><ShoppingBag/>Compras</span><strong>-{money(summary.purchaseOut,store?.currency)}</strong></div><div><span><WalletCards/>Gastos</span><strong>-{money(summary.expenseOut,store?.currency)}</strong></div><div className="breakdown-balance"><span><PiggyBank/>Balance del mes</span><strong>{money(summary.balance,store?.currency)}</strong></div></div></section>
    </div>

    <section className="card finance-movements"><div className="card-heading"><div><span className="section-kicker">MOVIMIENTOS</span><h2>Actividad financiera del mes</h2></div></div><div className="movement-list">{movements.length?movements.map(x=><div className="movement-row" key={x.id}><span className={`movement-icon ${x.type}`}>{x.type==='income'?<ArrowUpRight/>:<ArrowDownRight/>}</span><div><strong>{x.title}</strong><small>{safeDate(x.date).toLocaleString('es-NI')}</small></div><b className={x.type==='income'?'positive':'negative'}>{x.type==='income'?'+':'-'}{money(x.amount,store?.currency)}</b></div>):<div className="dashboard-empty"><WalletCards/><span>No hay movimientos en este mes.</span></div>}</div></section>
  </>
}
