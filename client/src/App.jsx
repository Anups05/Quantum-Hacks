import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, createContext } from 'react'
import Login from './pages/Login'
import GuardDashboard from './pages/GuardDashboard'
import ResidentDashboard from './pages/ResidentDashboard'
import AdminDashboard from './pages/AdminDashboard'

export const AuthContext = createContext(null)

// Mock users for demo
const MOCK_USERS = {
  guard: { id: 'g1', name: 'Rajesh Kumar', email: 'guard@society.com', role: 'guard', gate: 'Main Gate', avatar: 'RK' },
  resident: { id: 'r1', name: 'Priya Sharma', email: 'resident@society.com', role: 'resident', flat: 'A-302', phone: '+919876543210', avatar: 'PS' },
  admin: { id: 'a1', name: 'Vikram Singh', email: 'admin@society.com', role: 'admin', avatar: 'VS' },
}

function App() {
  const [user, setUser] = useState(null)

  const login = (role) => {
    setUser(MOCK_USERS[role])
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to={`/${user.role}`} />} />
        <Route path="/guard/*" element={user?.role === 'guard' ? <GuardDashboard /> : <Navigate to="/login" />} />
        <Route path="/resident/*" element={user?.role === 'resident' ? <ResidentDashboard /> : <Navigate to="/login" />} />
        <Route path="/admin/*" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={user ? `/${user.role}` : '/login'} />} />
      </Routes>
    </AuthContext.Provider>
  )
}

export default App
