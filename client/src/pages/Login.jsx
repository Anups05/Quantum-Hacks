import { useState } from 'react'
import { Shield, Eye, UserCheck, Lock, Mail, User, Building, Phone, ChevronRight } from 'lucide-react'
import { auth, db } from '../firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { validatePhoneFormat, checkPhoneUnique } from '../utils/phoneValidation'

const googleProvider = new GoogleAuthProvider()

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [selectedRole, setSelectedRole] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phoneNumber: '+91 ',
    societyName: '',
    flatGate: ''
  })

  const roles = [
    {
      id: 'guard', label: 'Security Guard', icon: Shield,
      desc: 'Log visitors, scan QR codes',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'resident', label: 'Resident', icon: UserCheck,
      desc: 'Approve visitors, view history',
      color: 'from-indigo-500 to-purple-500',
    },
    {
      id: 'admin', label: 'Society Admin', icon: Eye,
      desc: 'Analytics, alerts, security',
      color: 'from-amber-500 to-orange-500',
    },
  ]

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (isRegister && !selectedRole) {
      setErrorMsg('Please select a role to register.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    try {
      if (isRegister) {
        // Validation check
        if (!validatePhoneFormat(formData.phoneNumber)) {
          throw new Error('Phone number must be +91 followed by 10 digits.')
        }
        if (!formData.societyName.trim()) {
          throw new Error('Please enter your Society / Building name.')
        }

        // Lock App.jsx routing engine so it doesn't redirect mid-save
        localStorage.setItem('isLocalRegister', 'true')

        // Create Auth account
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password)
        const user = userCredential.user

        // Update display name
        await updateProfile(user, { displayName: formData.name })

        try {
          // Verify phone uniqueness (needs auth token for Firestore read)
          const isUnique = await checkPhoneUnique(formData.phoneNumber)
          if (!isUnique) {
            throw new Error('This phone number is already registered.')
          }

          const status = selectedRole === 'admin' ? 'approved' : 'pending'

          // Save user profile to Firestore
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: formData.name,
            email: formData.email,
            role: selectedRole,
            phoneNumber: formData.phoneNumber,
            societyName: formData.societyName.trim(),
            flatGate: formData.flatGate.trim().toUpperCase(),
            status: status,
            createdAt: new Date().toISOString()
          })
        } catch (dbError) {
          localStorage.removeItem('isLocalRegister')
          console.error('Firestore Registration DB Error:', dbError)
          throw new Error('Registration failed: ' + dbError.message)
        }
      } else {
        // Login flow
        await signInWithEmailAndPassword(auth, formData.email, formData.password)
      }
    } catch (error) {
      setErrorMsg(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      setErrorMsg(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden py-12">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4 shadow-lg shadow-indigo-500/25">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Secure<span className="text-gradient">Gate</span>
          </h1>
          <p className="text-slate-400 text-sm">
            Intelligent Visitor Security &amp; Entry Management
          </p>
        </div>

        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isRegister ? 'Create Account' : 'Sign In'}
          </h2>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg mb-4">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" name="name" required placeholder="Enter your name" className="input-field pl-10" value={formData.name} onChange={handleChange} />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="email" name="email" required placeholder="you@society.com" className="input-field pl-10" value={formData.email} onChange={handleChange} />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="password" name="password" required placeholder="••••••••" className="input-field pl-10" value={formData.password} onChange={handleChange} />
              </div>
            </div>

            {isRegister && (
              <>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="tel" name="phoneNumber" required placeholder="+91 98765 43210" className="input-field pl-10" value={formData.phoneNumber} onChange={handleChange} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Society / Building Name</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="text" name="societyName" required placeholder="e.g. Green Valley Apartments" className="input-field pl-10" value={formData.societyName} onChange={handleChange} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Flat / Gate</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="text" name="flatGate" required placeholder="e.g. A-302 or Main Gate" className="input-field pl-10" value={formData.flatGate} onChange={handleChange} />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Select Role</label>
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
                            isSelected
                              ? 'border-indigo-500/50 bg-indigo-500/10'
                              : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${role.color} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{role.label}</p>
                            <p className="text-xs text-slate-500 truncate">{role.desc}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-600'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || (isRegister && !selectedRole)}
              className={`w-full py-3 mt-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 ${
                !loading && (!isRegister || selectedRole)
                  ? 'gradient-primary hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {loading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
              {!loading && <ChevronRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-center space-x-2">
            <span className="h-px bg-slate-700 w-full"></span>
            <span className="text-slate-500 text-xs uppercase">or</span>
            <span className="h-px bg-slate-700 w-full"></span>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full mt-4 py-3 rounded-xl font-semibold text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white flex items-center justify-center gap-2 transition-all duration-300"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
            </svg>
            Continue with Google
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setErrorMsg('') }}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
