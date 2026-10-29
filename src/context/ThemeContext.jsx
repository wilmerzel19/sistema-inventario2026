import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

export const DESIGN_THEMES = [
  { id:'indigo', name:'Indigo Pro', description:'Tecnológico y profesional', colors:['#6366f1','#8b5cf6','#111827'] },
  { id:'emerald', name:'Esmeralda', description:'Fresco y comercial', colors:['#059669','#10b981','#052e2b'] },
  { id:'ocean', name:'Océano', description:'Azul moderno y limpio', colors:['#0284c7','#06b6d4','#082f49'] },
  { id:'sunset', name:'Sunset', description:'Cálido y enérgico', colors:['#ea580c','#f59e0b','#431407'] },
  { id:'rose', name:'Rose', description:'Elegante y creativo', colors:['#e11d48','#f43f5e','#4c0519'] },
  { id:'graphite', name:'Graphite', description:'Sobrio y minimalista', colors:['#475569','#64748b','#0f172a'] },
]

function getInitialTheme() {
  const saved = localStorage.getItem('super-inventario-theme')
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialDesign() {
  const saved = localStorage.getItem('super-inventario-design')
  return DESIGN_THEMES.some(item => item.id === saved) ? saved : 'indigo'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)
  const [design, setDesign] = useState(getInitialDesign)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('super-inventario-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.design = design
    localStorage.setItem('super-inventario-design', design)
  }, [design])

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme: () => setTheme(current => current === 'dark' ? 'light' : 'dark'),
    design,
    setDesign,
    designs: DESIGN_THEMES,
  }), [theme, design])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
