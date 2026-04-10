import { useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Building, Phone, ChevronRight, UserCheck, Eye } from 'lucide-react'
import { auth, db } from '../firebase'
import { doc, setDoc } from 'firebase/firestore'
import { AuthContext } from '../App'
import { validatePhoneFormat, checkPhoneUnique } from '../utils/phoneValidation'

export default function CompleteProfile() {
  const { user, setUser } = useContext(AuthContext)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    phoneNumber: '+91 ',
    societyName: '',
    flatGate: '',
  })

  const [selectedRole, setSelectedRole] = useState(null)

  const roles = [
    {
      id: 'guard', label: 'Security Guard', icon: Shield,
      desc: 'Log visitors, scan QR codes',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'resident', label: 'Resident', icon: UserCheck,
      desc: 'Approve visitors, view history',
      color: 'from-indigo-500 to-purple-500'
    },
    {
      id: 'admin', label: 'Society Admin', icon: Eye,
      desc: 'Analytics, alerts, security',
      color: 'from-amber-500 to-orange-500'
    },
  ]

  useEffect(() => {
    if (!user || user.role) {
      // If no auth user or if user already has a role, redirect to appropriate place
      const dest = user?.role ? `/${user.role}` : '/login'
      navigate(dest, { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedRole || !user?.uid) return
    setLoading(true)

    try {
      if (!validatePhoneFormat(formData.phoneNumber)) {
        throw new Error('Phone number must be +91 followed by 10 digits.')
      }
      
      const isUnique = await checkPhoneUnique(formData.phoneNumber, user.uid)
      if (!isUnique) {
        throw new Error('This phone number is already registered to another account.')
      }

      const status = selectedRole === 'admin' ? 'approved' : 'pending'

      const userData = {
        uid: user.uid,
        name: user.displayName || user.name || '',
        email: user.email,
        role: selectedRole,
        phoneNumber: formData.phoneNumber,
        societyName: formData.societyName,
        flatGate: formData.flatGate.trim().toUpperCase(),
        status: status,
        createdAt: new Date().toISOString()
      }

      await setDoc(doc(db, 'users', user.uid), userData)
      // Update local state so App.jsx routing redirects properly
      setUser({ ...user, ...userData })
    } catch (err) {
      console.error('Error saving profile:', err)
      alert("Failed to complete profile: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 glass-card p-8">
        <h2 className="text-2xl font-bold text-white mb-2">Complete Profile</h2>
        <p className="text-sm text-slate-400 mb-6">We need a few more details to set up your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="tel" 
                placeholder="+91 98765 43210" 
                className="input-field pl-10" 
                required
                value={formData.phoneNumber}
                onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Society/Building/Complex Name</label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="e.g. Green Valley Apts" 
                className="input-field pl-10" 
                required
                value={formData.societyName}
                onChange={(e) => setFormData({...formData, societyName: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Flat / Gate (if applicable)</label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="e.g. A-302 or Main Gate" 
                className="input-field pl-10" 
                required
                value={formData.flatGate}
                onChange={(e) => setFormData({...formData, flatGate: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Select Your Role</label>
            <div className="space-y-2">
              {roles.map((role) => {
                const Icon = role.icon
                const isSelected = selectedRole === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 text-left ${
                      isSelected ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${role.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{role.label}</p>
                      <p className="text-xs text-slate-500 truncate">{role.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={!selectedRole || loading}
            className={`w-full mt-6 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 ${
              selectedRole && !loading
                ? 'gradient-primary hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Saving...' : 'Complete Setup'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
