import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CartaCliente from './pages/cliente/CartaCliente'
import PanelCamarero from './pages/camarero/PanelCamarero'
import PantallaKDS from './pages/cocina/PantallaKDS'
import PantallaBarra from './pages/barra/PantallaBarra'
import PanelAdmin from './pages/admin/PanelAdmin'
import Home from './pages/Home'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mesa/:mesaId" element={<CartaCliente />} />
        <Route path="/camarero" element={<PanelCamarero />} />
        <Route path="/cocina" element={<PantallaKDS />} />
        <Route path="/barra" element={<PantallaBarra />} />
        <Route path="/admin" element={<PanelAdmin />} />
        <Route path="*" element={<Navigate to="/" /> } />
      </Routes>
    </BrowserRouter>
  )
}
