import { useEffect, useMemo, useState } from 'react'
import { Calculator, Delete, History, X } from 'lucide-react'

const ops = { '+': (a,b) => a+b, '−': (a,b) => a-b, '×': (a,b) => a*b, '÷': (a,b) => b === 0 ? NaN : a/b }

function neat(value) {
  if (!Number.isFinite(Number(value))) return 'Error'
  const n = Number(value)
  if (Math.abs(n) >= 1e12 || (Math.abs(n) > 0 && Math.abs(n) < 1e-7)) return n.toExponential(6)
  return Number(n.toPrecision(12)).toString()
}

export default function CalculatorPanel({ open, onClose }) {
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState(null)
  const [operator, setOperator] = useState(null)
  const [fresh, setFresh] = useState(true)
  const [history, setHistory] = useState([])

  const expression = useMemo(() => stored !== null && operator ? `${neat(stored)} ${operator}` : 'Calculadora rápida', [stored, operator])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (/^[0-9.]$/.test(e.key)) inputDigit(e.key)
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals() }
      else if (e.key === 'Escape') onClose?.()
      else if (e.key === 'Backspace') backspace()
      else if (['+','-','*','/'].includes(e.key)) chooseOp({ '-':'−','*':'×','/':'÷' }[e.key] || e.key)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  function clear() { setDisplay('0'); setStored(null); setOperator(null); setFresh(true) }
  function inputDigit(value) {
    setDisplay(current => {
      if (fresh || current === 'Error') { setFresh(false); return value === '.' ? '0.' : value }
      if (value === '.' && current.includes('.')) return current
      if (current.replace('-','').length >= 14) return current
      return current === '0' && value !== '.' ? value : current + value
    })
  }
  function backspace() {
    if (fresh) return
    setDisplay(current => current.length <= 1 || (current.length === 2 && current.startsWith('-')) ? '0' : current.slice(0,-1))
  }
  function toggleSign() { if (display !== '0' && display !== 'Error') setDisplay(neat(-Number(display))) }
  function percent() { if (display !== 'Error') setDisplay(neat(Number(display) / 100)); setFresh(true) }
  function chooseOp(next) {
    if (display === 'Error') return clear()
    const current = Number(display)
    if (stored !== null && operator && !fresh) {
      const result = ops[operator](stored, current)
      if (!Number.isFinite(result)) { setDisplay('Error'); setStored(null); setOperator(null); setFresh(true); return }
      setStored(result); setDisplay(neat(result))
    } else setStored(current)
    setOperator(next); setFresh(true)
  }
  function equals() {
    if (stored === null || !operator || display === 'Error') return
    const right = Number(display)
    const result = ops[operator](stored, right)
    const leftText = neat(stored)
    const rightText = neat(right)
    const resultText = neat(result)
    setHistory(items => [`${leftText} ${operator} ${rightText} = ${resultText}`, ...items].slice(0,6))
    setDisplay(resultText); setStored(null); setOperator(null); setFresh(true)
  }

  if (!open) return null
  return <div className="calculator-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
    <section className="calculator-panel" aria-label="Calculadora">
      <header><div><span><Calculator size={18}/></span><div><strong>Calculadora</strong><small>Disponible en todo el sistema</small></div></div><button onClick={onClose} aria-label="Cerrar"><X size={19}/></button></header>
      <div className="calculator-screen"><small>{expression}</small><strong>{display}</strong></div>
      <div className="calculator-keys">
        <button className="calc-soft" onClick={clear}>AC</button><button className="calc-soft" onClick={toggleSign}>±</button><button className="calc-soft" onClick={percent}>%</button><button className="calc-op" onClick={() => chooseOp('÷')}>÷</button>
        <button onClick={() => inputDigit('7')}>7</button><button onClick={() => inputDigit('8')}>8</button><button onClick={() => inputDigit('9')}>9</button><button className="calc-op" onClick={() => chooseOp('×')}>×</button>
        <button onClick={() => inputDigit('4')}>4</button><button onClick={() => inputDigit('5')}>5</button><button onClick={() => inputDigit('6')}>6</button><button className="calc-op" onClick={() => chooseOp('−')}>−</button>
        <button onClick={() => inputDigit('1')}>1</button><button onClick={() => inputDigit('2')}>2</button><button onClick={() => inputDigit('3')}>3</button><button className="calc-op" onClick={() => chooseOp('+')}>+</button>
        <button className="calc-back" onClick={backspace}><Delete size={18}/></button><button onClick={() => inputDigit('0')}>0</button><button onClick={() => inputDigit('.')}>.</button><button className="calc-equals" onClick={equals}>=</button>
      </div>
      {history.length > 0 && <div className="calculator-history"><div><History size={14}/><strong>Historial</strong><button onClick={() => setHistory([])}>Limpiar</button></div>{history.map((item,i) => <small key={`${item}-${i}`}>{item}</small>)}</div>}
    </section>
  </div>
}
