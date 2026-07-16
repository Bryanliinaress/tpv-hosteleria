import { useState } from 'react'
import Ticket from '../../components/Ticket'

// Vista previa del formato de ticket con datos de ejemplo (sin login).
// Útil para ajustar el diseño y probar la impresión térmica.
const MESA = {
  id: 'demo', numero: 8, zona: 'Terraza', camarero: 'Aida',
  personas: [
    { id: 'p1', nombre: 'Aida', pagado: false, propina: 0, items: [
      { uid: 'a', nombre: 'Fanta Naranja', precio: 2.70, cantidad: 1, tipo: 'bebida' },
      { uid: 'b', nombre: 'Patatas Pulled Pork', precio: 9.95, cantidad: 1, tipo: 'comida' },
      { uid: 'c', nombre: 'Campero Aida', precio: 7.95, cantidad: 1, tipo: 'comida' },
    ] },
    { id: 'p2', nombre: 'Luis', pagado: false, propina: 0, items: [
      { uid: 'd', nombre: 'Cocacola Zero', precio: 2.70, cantidad: 1, tipo: 'bebida' },
      { uid: 'e', nombre: 'Campero Los Montes', precio: 8.50, cantidad: 1, tipo: 'comida' },
    ] },
  ],
}

export default function TicketDemo() {
  const [tipo, setTipo] = useState('cuenta')
  const [abierto, setAbierto] = useState(true)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
      <h1 style={{ fontWeight: 800 }}>🧾 Vista previa del ticket</h1>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => { setTipo('cuenta'); setAbierto(true) }} style={btn}>Cuenta</button>
        <button onClick={() => { setTipo('comanda'); setAbierto(true) }} style={btn}>Comanda</button>
      </div>
      {abierto && <Ticket tipo={tipo} mesa={MESA} onClose={() => setAbierto(false)} />}
    </div>
  )
}

const btn = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 600 }
