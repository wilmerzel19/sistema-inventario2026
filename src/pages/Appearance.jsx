import { Check, Moon, Palette, Sparkles, Sun } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useTheme } from '../context/ThemeContext'

export default function Appearance() {
  const { theme, setTheme, design, setDesign, designs } = useTheme()

  return <>
    <PageHeader title="Apariencia" subtitle="Personaliza el estilo del sistema. Tus cambios se guardan automáticamente en este dispositivo." />

    <div className="appearance-layout">
      <section className="card appearance-section">
        <div className="appearance-heading">
          <span><Sun size={20}/></span>
          <div><strong>Modo de interfaz</strong><small>Elige claro u oscuro.</small></div>
        </div>
        <div className="mode-picker">
          <button className={theme === 'light' ? 'selected' : ''} onClick={() => setTheme('light')}>
            <div className="mode-preview light"><span/><span/><span/></div>
            <div><Sun size={17}/><strong>Claro</strong></div>
            {theme === 'light' && <Check size={17}/>} 
          </button>
          <button className={theme === 'dark' ? 'selected' : ''} onClick={() => setTheme('dark')}>
            <div className="mode-preview dark"><span/><span/><span/></div>
            <div><Moon size={17}/><strong>Oscuro</strong></div>
            {theme === 'dark' && <Check size={17}/>} 
          </button>
        </div>
      </section>

      <section className="card appearance-section">
        <div className="appearance-heading">
          <span><Palette size={20}/></span>
          <div><strong>Diseño del sistema</strong><small>Cambia colores, sidebar, botones y acentos sin tocar código.</small></div>
        </div>
        <div className="design-grid">
          {designs.map(item => <button key={item.id} className={`design-card ${design === item.id ? 'selected' : ''}`} onClick={() => setDesign(item.id)}>
            <div className="design-swatch" style={{'--c1':item.colors[0],'--c2':item.colors[1],'--c3':item.colors[2]}}>
              <span className="swatch-sidebar"/><span className="swatch-card one"/><span className="swatch-card two"/><span className="swatch-button"/>
            </div>
            <div className="design-copy"><strong>{item.name}</strong><small>{item.description}</small></div>
            {design === item.id && <span className="design-check"><Check size={15}/></span>}
          </button>)}
        </div>
      </section>

      <section className="card appearance-tip">
        <Sparkles size={22}/><div><strong>Combinaciones independientes</strong><p>Puedes usar cualquier diseño en modo claro u oscuro. El catálogo público conserva el color de marca configurado para tu tienda.</p></div>
      </section>
    </div>
  </>
}
