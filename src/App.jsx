import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Protegido from './components/Protegido'
import UIHost from './components/UIHost'

// Carga diferida por ruta: cada pantalla es su propio chunk. El cliente que
// escanea el QR solo descarga la carta + lo compartido, no Admin/KDS/PDA.
const Home = lazy(() => import('./pages/Home'))
const CartaCliente = lazy(() => import('./pages/cliente/CartaCliente'))
const Reservar = lazy(() => import('./pages/reservar/Reservar'))
const PanelCamarero = lazy(() => import('./pages/camarero/PanelCamarero'))
const PdaCamarero = lazy(() => import('./pages/pda/PdaCamarero'))
const PantallaKDS = lazy(() => import('./pages/cocina/PantallaKDS'))
const PantallaBarra = lazy(() => import('./pages/barra/PantallaBarra'))
const PanelAdmin = lazy(() => import('./pages/admin/PanelAdmin'))
const PrintStation = lazy(() => import('./pages/print/PrintStation'))
const Onboarding = lazy(() => import('./pages/setup/Onboarding'))
const TicketDemo = lazy(() => import('./pages/print/TicketDemo'))

function Cargando() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <UIHost />
      <Suspense fallback={<Cargando />}>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Cliente: carta por QR y reservas, sin login */}
          <Route path="/mesa/:mesaId" element={<CartaCliente />} />
          <Route path="/reservar" element={<Reservar />} />
          {/* Personal: requiere PIN de empleado activo */}
          <Route path="/camarero" element={<Protegido><PanelCamarero /></Protegido>} />
          <Route path="/pda" element={<Protegido><PdaCamarero /></Protegido>} />
          <Route path="/cocina" element={<Protegido><PantallaKDS /></Protegido>} />
          <Route path="/barra" element={<Protegido><PantallaBarra /></Protegido>} />
          <Route path="/print" element={<Protegido><PrintStation /></Protegido>} />
          {/* Admin: requiere PIN de administrador */}
          <Route path="/admin" element={<Protegido rol="admin"><PanelAdmin /></Protegido>} />
          <Route path="/setup" element={<Protegido rol="admin"><Onboarding /></Protegido>} />
          <Route path="/ticket-demo" element={<TicketDemo />} />
          <Route path="*" element={<Navigate to="/" /> } />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
