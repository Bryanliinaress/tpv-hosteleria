import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import CartaCliente from './pages/cliente/CartaCliente'
import PanelCamarero from './pages/camarero/PanelCamarero'
import PdaCamarero from './pages/pda/PdaCamarero'
import PantallaKDS from './pages/cocina/PantallaKDS'
import PantallaBarra from './pages/barra/PantallaBarra'
import PanelAdmin from './pages/admin/PanelAdmin'
import PrintStation from './pages/print/PrintStation'
import Reservar from './pages/reservar/Reservar'
import Home from './pages/Home'
import Onboarding from './pages/setup/Onboarding'
import Protegido from './components/Protegido'
import UIHost from './components/UIHost'

export default function App() {
  return (
    <HashRouter>
      <UIHost />
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
        <Route path="*" element={<Navigate to="/" /> } />
      </Routes>
    </HashRouter>
  )
}
