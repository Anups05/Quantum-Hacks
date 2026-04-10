import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, createContext, useEffect } from 'react'
import Login from './pages/Login'
import CompleteProfile from './pages/CompleteProfile'
import GuardDashboard from './pages/GuardDashboard'
import ResidentDashboard from './pages/ResidentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import { auth, db } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

export const AuthContext = createContext(null)

function App() {
  const [user, setUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch custom user data from Firestore
        try {
          const docRef = doc(db, 'users', firebaseUser.uid)
          const docSnap = await getDoc(docRef)
          
          if (docSnap.exists()) {
            const userData = docSnap.data()
            setUser({ ...firebaseUser, ...userData })
          } else {
            // User exists in Auth but not in Firestore Database -> redirect to CompleteProfile
            setUser(firebaseUser)
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
          setUser(firebaseUser) // Default to auth user if firestore fails
        }
      } else {
        setUser(null)
      }
      setLoadingAuth(false)
    })

    return () => unsubscribe()
  }, [])

  const logout = () => {
    signOut(auth).then(() => {
      setUser(null)
    }).catch((error) => console.error("Error signing out: ", error))
  }

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>
  }

  // Ensure routing functions correctly
  const renderDashboard = () => {
    if (!user) return <Navigate to="/login" />
    if (!user.role) return <Navigate to="/complete-profile" />
    return <Navigate to={`/${user.role}`} />
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : (user.role ? <Navigate to={`/${user.role}`} /> : <Navigate to="/complete-profile" />)} />
        <Route path="/complete-profile" element={user && !user.role ? <CompleteProfile /> : renderDashboard()} />
        <Route path="/guard/*" element={user?.role === 'guard' ? <GuardDashboard /> : renderDashboard()} />
        <Route path="/resident/*" element={user?.role === 'resident' ? <ResidentDashboard /> : renderDashboard()} />
        <Route path="/admin/*" element={user?.role === 'admin' ? <AdminDashboard /> : renderDashboard()} />
        <Route path="*" element={renderDashboard()} />
      </Routes>
    </AuthContext.Provider>
  )
}

export default App
