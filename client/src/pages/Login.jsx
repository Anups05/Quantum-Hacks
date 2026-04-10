import { useContext, useState } from 'react'
import { AuthContext } from '../App'
import { Shield, Eye, UserCheck, Lock, Mail, User, Building, Phone, ChevronRight } from 'lucide-react'

export default function Login() {
  const { login } = useContext(AuthContext)
  const [isRegister, setIsRegister] = useState(false)
  const [selectedRole, setSelectedRole] = useState(null)

  const roles = [
    {
      id: 'guard', label: 'Security Guard', icon: Shield,
      desc: 'Log visitors, scan QR codes, manage entry/exit',
      color: 'from-blue-500 to-cyan-500', bgGlow: 'rgba(14, 165, 233, 0.15)',
    },
    {
      id: 'resident', label: 'Resident', icon: UserCheck,
      desc: 'Approve visitors, manage passes, view history',
      color: 'from-indigo-500 to-purple-500', bgGlow: 'rgba(99, 102, 241, 0.15)',
    },
    {
      id: 'admin', label: 'Society Admin', icon: Eye,
      desc: 'Analytics, alerts, security oversight',
      color: 'from-amber-500 to-orange-500', bgGlow: 'rgba(245, 158, 11, 0.15)',
    },
  ]

  const handleLogin = (e) => {
    e.preventDefault()
    if (selectedRole) login(selectedRole)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
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
            Intelligent Visitor Security & Entry Management
          </p>
        </div>

        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isRegister ? 'Create Account' : 'Sign In'}
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" placeholder="Enter your name" className="input-field pl-10" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="email" placeholder="you@society.com" className="input-field pl-10" defaultValue="guard@society.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="password" placeholder="••••••••" className="input-field pl-10" defaultValue="password" />
              </div>
            </div>

            {isRegister && (
              <>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="tel" placeholder="+91 98765 43210" className="input-field pl-10" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Flat / Gate (if applicable)</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="text" placeholder="e.g. A-302 or Main Gate" className="input-field pl-10" />
                  </div>
                </div>
              </>
            )}

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

            <button
              type="submit"
              disabled={!selectedRole}
              className={`w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 ${
                selectedRole
                  ? 'gradient-primary hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isRegister ? 'Create Account' : 'Sign In'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>
        </div>

        {/* Demo hint */}
        <p className="text-center text-xs text-slate-600 mt-4">
          Demo: Select any role and click Sign In
        </p>
      </div>
    </div>
  )
}
