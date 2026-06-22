import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import Appointment from './pages/Appointment'
import MedicalCenter from './pages/MedicalCenter'
import PatientArchive from './pages/PatientArchive'
import Consumable from './pages/Consumable'
import Statistics from './pages/Statistics'
import Login from './pages/Login'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="appointment" element={<Appointment />} />
        <Route path="medical" element={<MedicalCenter />} />
        <Route path="patients" element={<PatientArchive />} />
        <Route path="consumable" element={<Consumable />} />
        <Route path="statistics" element={<Statistics />} />
      </Route>
    </Routes>
  )
}

export default App
