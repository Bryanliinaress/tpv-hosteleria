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

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mesa/:mesaId" element={<CartaCliente />} />
        <Route path="/camarero" element={<PanelCamarero />} />
        <Route path="/pda" element={<PdaCamarero />} />
        <Route path="/cocina" element={<PantallaKDS />} />
        <Route path="/barra" element={<PantallaBarra />} />
        <Route path="/admin" element={<PanelAdmin />} />
        <Route path="/print" element={<PrintStation />} />
        <Route path="/reservar" element={<Reservar />} />
        <Route path="*" element={<Navigate to="/" /> } />
      </Routes>
    </HashRouter>
  )
}
