import { useState, useContext, useEffect, useRef } from 'react'
import { AuthContext } from '../App'
import {
  Shield, LogOut, Plus, QrCode, Camera, AlertTriangle,
  CheckCircle, XCircle, Clock, Users, UserPlus, Search,
  Phone, Home, Eye, MapPin, Bell, X, Send, User,
  ScanLine, LogIn, DoorOpen
} from 'lucide-react'
import { mockAlerts, getTimeAgo, getStatusColor, getStatusLabel } from '../data/mockData'
import { QRCodeSVG } from 'qrcode.react'
import { validatePhoneFormat } from '../utils/phoneValidation'
import {
  compressImageToBase64, lookupVisitorProfile, saveVisitorProfile,
  logVisitorEntry, getTodayEntries, markVisitorInside,
  markVisitorExit, getAllVisitorsForSociety, decryptPhoto,
  verifyOtpToken
} from '../utils/visitorHelpers'

export default function GuardDashboard() {
  const { user, logout } = useContext(AuthContext)
  const [activeTab, setActiveTab] = useState('home')
  const [notifications] = useState(mockAlerts.filter(a => !a.resolved).length)

  // Lift todayEntries to parent so polling runs regardless of active tab
  const [todayEntries, setTodayEntries] = useState([])
  const [entriesLoading, setEntriesLoading] = useState(true)

  useEffect(() => {
    if (!user?.societyName) return
    const load = () => {
      getTodayEntries(user.societyName)
        .then(entries => { setTodayEntries(entries); setEntriesLoading(false) })
        .catch(() => setEntriesLoading(false))
    }
    load()
    // Poll every 4s — so approvals from residents show QR within a few seconds
    const interval = setInterval(load, 4000)
    return () => clearInterval(interval)
  }, [user])

  // Pending count for badge
  const pendingCount = todayEntries.filter(v => v.status === 'pending').length
  const approvedCount = todayEntries.filter(v => v.status === 'approved').length

  const tabs = [
    { id: 'home', label: 'Dashboard', icon: Home, badge: pendingCount + approvedCount },
    { id: 'log', label: 'New Entry', icon: UserPlus },
    { id: 'scan', label: 'Scan QR', icon: QrCode },
    { id: 'visitors', label: 'Visitors', icon: Users },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-dark)]">
      {/* Top Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">SecureGate</h1>
              <p className="text-[10px] text-slate-500">{user.flatGate || 'Gate'} • Guard Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-xl bg-slate-800/60 text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                {user?.name?.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() || 'U'}
              </div>
              <button onClick={logout} className="p-2 rounded-xl text-slate-500 hover:text-red-400 transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="sticky top-[60px] z-40 bg-[var(--color-dark)]/95 backdrop-blur border-b border-slate-800 px-4">
        <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="absolute -top-0.5 right-1 w-4 h-4 rounded-full bg-amber-500 text-[9px] text-white font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 pb-24 space-y-4">
        {activeTab === 'home' && <HomeTab user={user} todayEntries={todayEntries} loading={entriesLoading} setTodayEntries={setTodayEntries} onNavigate={setActiveTab} />}
        {activeTab === 'log' && <NewEntryTab user={user} approvedEntries={todayEntries.filter(v => v.status === 'approved')} onDone={() => setActiveTab('home')} />}
        {activeTab === 'scan' && <ScanTab user={user} />}
        {activeTab === 'visitors' && <VisitorsTab user={user} />}
      </main>

      {/* Panic Button */}
      <button className="panic-btn" title="Emergency Alert">
        <AlertTriangle className="w-7 h-7" />
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────── HOME TAB ─── */
function HomeTab({ user, todayEntries, loading, setTodayEntries, onNavigate }) {
  const pending = todayEntries.filter(v => v.status === 'pending')
  const inside = todayEntries.filter(v => v.status === 'inside')

  const handleStatusChange = (updatedId, newStatus) => {
    setTodayEntries(prev => prev.map(v => v.id === updatedId ? { ...v, status: newStatus } : v))
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xs text-slate-500">Today</span>
          </div>
          <p className="text-2xl font-bold text-white">{loading ? '—' : todayEntries.length}</p>
          <p className="text-xs text-slate-500">Total Visitors</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xs text-slate-500">Waiting</span>
          </div>
          <p className="text-2xl font-bold text-white">{loading ? '—' : pending.length}</p>
          <p className="text-xs text-slate-500">Pending Approval</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-xs text-slate-500">Active</span>
          </div>
          <p className="text-2xl font-bold text-white">{loading ? '—' : inside.length}</p>
          <p className="text-xs text-slate-500">Currently Inside</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <span className="text-xs text-slate-500">Alerts</span>
          </div>
          <p className="text-2xl font-bold text-white">{mockAlerts.filter(a => !a.resolved).length}</p>
          <p className="text-xs text-slate-500">Active Alerts</p>
        </div>
      </div>

      {/* Active Alerts (mock) */}
      {mockAlerts.filter(a => !a.resolved).length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Active Alerts</h3>
          </div>
          <div className="space-y-2">
            {mockAlerts.filter(a => !a.resolved).map(alert => (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                alert.type === 'critical' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
              }`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  alert.type === 'critical' ? 'bg-red-500 pulse-dot' : 'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{alert.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{alert.message}</p>
                  <p className="text-[10px] text-slate-600 mt-1">{getTimeAgo(alert.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Visitors */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" /> Active Visitors
          </h3>
          <button onClick={() => onNavigate('log')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <Plus className="w-3 h-3" /> New Entry
          </button>
        </div>
        {loading ? (
          <p className="text-slate-500 text-sm text-center py-8">Loading...</p>
        ) : todayEntries.filter(v => ['pending', 'approved', 'inside'].includes(v.status)).length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No active visitors right now</p>
            <p className="text-xs text-slate-600 mt-1">Log a new visitor to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayEntries
              .filter(v => ['pending', 'approved', 'inside'].includes(v.status))
              .map(visitor => (
                <ActiveVisitorCard
                  key={visitor.id}
                  visitor={visitor}
                  onStatusChange={handleStatusChange}
                />
              ))}
          </div>
        )}
      </div>
    </>
  )
}

/* ─────────────────────────── ACTIVE VISITOR CARD ─── */
function ActiveVisitorCard({ visitor, onStatusChange }) {
  const [busy, setBusy] = useState(false)

  const handleMarkExit = async () => {
    setBusy(true)
    await markVisitorExit(visitor.id)
    onStatusChange(visitor.id, 'exited')
    setBusy(false)
  }

  return (
    <div className="glass-card-hover p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {visitor.photo ? (
            <img src={visitor.photo} alt={visitor.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-slate-500">{visitor.name?.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-white">{visitor.name}</p>
                <span className={`badge ${
                  visitor.status === 'pending' ? 'badge-warning' :
                  visitor.status === 'approved' ? 'badge-info' :
                  visitor.status === 'inside' ? 'badge-success' : 'badge-neutral'
                }`}>
                  {visitor.status === 'pending' ? 'Pending' :
                   visitor.status === 'approved' ? 'Approved — QR Ready' :
                   visitor.status === 'inside' ? 'Inside' : visitor.status}
                </span>
                {visitor.faceMatch === 'matched' && (
                  <span className="text-[10px] text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Face matched
                  </span>
                )}
                {visitor.faceMatch === 'mismatch' && (
                  <span className="text-[10px] text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Face mismatch!
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Home className="w-3 h-3" />{visitor.flatGate}</span>
                <span>{visitor.purpose}</span>
                <span>{getTimeAgo(visitor.entryTimestamp)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {visitor.status === 'pending' && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Waiting for resident approval...
              </span>
            )}
            {visitor.status === 'inside' && (
              <button
                onClick={handleMarkExit}
                disabled={busy}
                className="btn-outline text-xs py-1.5 px-3"
              >
                <DoorOpen className="w-3 h-3" /> Mark Exit
              </button>
            )}
          </div>

          {/* QR Pass — auto-shown when approved, contains OTP for visitor to scan */}
          {visitor.status === 'approved' && visitor.qrToken && (
            <div className="mt-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
              <p className="text-xs text-indigo-400 mb-2 flex items-center gap-1">
                <QrCode className="w-3 h-3" /> Resident approved. Show QR to visitor to scan:
              </p>
              <div className="flex gap-4 items-center">
                <div className="p-2 bg-white rounded-xl inline-block">
                  <QRCodeSVG value={visitor.qrToken} size={100} />
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p>Visitor scans QR with phone</p>
                  <p>Gets a <span className="text-white font-bold">6-digit OTP</span></p>
                  <p>Guard enters OTP in</p>
                  <p className="text-indigo-400 font-medium">Scan QR tab → Verify</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── NEW ENTRY TAB ─── */
function NewEntryTab({ user, approvedEntries, onDone }) {
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(null)  // holds the created visitor entry

  const [formData, setFormData] = useState({
    name: '', phone: '+91', purpose: '', flatGate: '', photo: null
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [returningProfile, setReturningProfile] = useState(null)  // existing visitor profile
  const [faceCheckDone, setFaceCheckDone] = useState(false)
  const [faceMatch, setFaceMatch] = useState('new')  // 'new' | 'matched' | 'mismatch'

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    const base64 = await compressImageToBase64(file)
    setFormData(prev => ({ ...prev, photo: base64 }))
  }

  // When phone changes, look up existing profile
  const handlePhoneBlur = async () => {
    if (!validatePhoneFormat(formData.phone)) return
    setReturningProfile(null)
    setFaceCheckDone(false)
    const profile = await lookupVisitorProfile(formData.phone)
    if (profile) {
      setReturningProfile(profile)
    }
  }

  // Guard manually confirms face match/mismatch
  const handleFaceDecision = (decision) => {
    setFaceMatch(decision)
    setFaceCheckDone(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!validatePhoneFormat(formData.phone)) {
      setError('Phone number must be +91 followed by exactly 10 digits.')
      return
    }
    if (!formData.name.trim()) {
      setError('Visitor name is required.')
      return
    }
    if (!formData.purpose.trim()) {
      setError('Purpose of visit is required.')
      return
    }
    if (!formData.flatGate.trim()) {
      setError('Flat number is required.')
      return
    }
    if (!formData.photo) {
      setError('Visitor photo is required.')
      return
    }
    if (returningProfile && !faceCheckDone) {
      setError('Please confirm the face match result before submitting.')
      return
    }

    setLoading(true)
    try {
      // Save profile if new visitor
      if (!returningProfile) {
        await saveVisitorProfile({
          phone: formData.phone,
          name: formData.name,
          photo: formData.photo,
          societyName: user.societyName
        })
      }

      const entry = await logVisitorEntry({
        name: formData.name,
        phone: formData.phone,
        purpose: formData.purpose,
        flatGate: formData.flatGate.trim().toUpperCase(),
        societyName: user.societyName,
        enteredBy: user.uid,
        photo: formData.photo,
        faceMatch: returningProfile ? faceMatch : 'new'
      })

      setSubmitted(entry)
    } catch (err) {
      setError('Failed to log entry: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return <EntrySuccess entry={submitted} approvedEntries={approvedEntries} onReset={() => {
      setSubmitted(null)
      setFormData({ name: '', phone: '+91', purpose: '', flatGate: '', photo: null })
      setPhotoFile(null)
      setReturningProfile(null)
      setFaceCheckDone(false)
      setFaceMatch('new')
    }} />
  }

  return (
    <div className="animate-fade-in">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" /> Log New Visitor
          </h3>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Photo */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Visitor Photo *</label>
            <div className="flex gap-4 items-start">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-28 h-28 rounded-xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-500 transition-colors"
              >
                {formData.photo ? (
                  <img src={formData.photo} alt="Visitor" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2">
                    <Camera className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-500">Click to upload</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handlePhotoChange} />
              <div className="text-xs text-slate-500 mt-2">
                <p>Upload a clear photo of the visitor.</p>
                <p className="mt-1 text-slate-600">Used for face verification on repeat visits.</p>
              </div>
            </div>
          </div>

          {/* Name + Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Visitor Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Full name"
                  className="input-field pl-10"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  className="input-field pl-10"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  onBlur={handlePhoneBlur}
                  required
                />
              </div>
              {returningProfile && (
                <p className="text-xs text-indigo-400 mt-1 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Returning visitor found
                </p>
              )}
            </div>
          </div>

          {/* Purpose + Flat */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Purpose of Visit *</label>
              <input
                type="text"
                placeholder="e.g. Guest, Delivery, Repair..."
                className="input-field"
                value={formData.purpose}
                onChange={e => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Flat Number *</label>
              <div className="relative">
                <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. A-302"
                  className="input-field pl-10"
                  value={formData.flatGate}
                  onChange={e => setFormData(prev => ({ ...prev, flatGate: e.target.value }))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Face Comparison Panel — only for returning visitors */}
          {returningProfile && formData.photo && (
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-400" /> Face Comparison
              </p>
              <p className="text-xs text-slate-400">
                This visitor's phone number is already registered. Compare the stored photo with the current visitor.
              </p>
              <div className="flex gap-4">
                <div className="flex-1 text-center">
                  <p className="text-[10px] text-slate-500 mb-2">Stored Photo</p>
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 mx-auto">
                    {returningProfile.photo ? (
                      <img
                        src={decryptPhoto(returningProfile.photo)}
                        alt="Stored"
                        className="w-full h-full object-cover"
                        onError={e => { e.target.style.display='none' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-8 h-8 text-slate-600" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{returningProfile.name}</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[10px] text-slate-500 mb-2">Current Photo</p>
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 mx-auto">
                    <img src={formData.photo} alt="Current" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{formData.name || 'New entry'}</p>
                </div>
              </div>
              {!faceCheckDone ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleFaceDecision('matched')}
                    className="flex-1 py-2 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/25 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" /> Same Person
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFaceDecision('mismatch')}
                    className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors"
                  >
                    <XCircle className="w-4 h-4 inline mr-1" /> Different Person
                  </button>
                </div>
              ) : (
                <div className={`flex items-center gap-2 p-2 rounded-lg ${
                  faceMatch === 'matched' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {faceMatch === 'matched'
                    ? <><CheckCircle className="w-4 h-4" /> Face confirmed as same person</>
                    : <><AlertTriangle className="w-4 h-4" /> Face mismatch recorded — proceeding with caution</>
                  }
                  <button type="button" onClick={() => setFaceCheckDone(false)} className="ml-auto text-xs underline opacity-60">
                    Change
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-green-400" />
            <span>Entry logged at {user.flatGate || 'Gate'} — {new Date().toLocaleTimeString('en-IN')}</span>
          </div>

          <button type="submit" disabled={loading} className="w-full btn-primary justify-center py-3">
            <Send className="w-4 h-4" />
            {loading ? 'Saving...' : 'Submit & Notify Resident'}
          </button>
        </form>
      </div>
    </div>
  )
}
/* ─────────────────────────── ENTRY SUCCESS ─── */
function EntrySuccess({ entry, approvedEntries, onReset }) {
  // Check real-time if this specific entry has been approved
  const approvedEntry = approvedEntries?.find(v => v.id === entry.id)
  const isApproved = !!approvedEntry

  return (
    <div className="glass-card p-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-green-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">Visitor Logged!</h3>
      <p className="text-sm text-slate-400 mb-5">
        Resident of flat <span className="text-white font-semibold">{entry.flatGate}</span> has been notified.
        Awaiting their approval.
      </p>

      <div className="glass-card p-4 mb-5 text-left space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Entry Details</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-slate-500">Name:</span> <span className="text-white">{entry.name}</span></div>
          <div><span className="text-slate-500">Phone:</span> <span className="text-white">{entry.phone}</span></div>
          <div><span className="text-slate-500">Purpose:</span> <span className="text-white">{entry.purpose}</span></div>
          <div><span className="text-slate-500">Flat:</span> <span className="text-white">{entry.flatGate}</span></div>
          <div className="col-span-2">
            <span className="text-slate-500">Time:</span>{' '}
            <span className="text-white">{new Date(entry.entryTimestamp).toLocaleString('en-IN')}</span>
          </div>
        </div>
        <div className={`mt-2 flex items-center gap-2 text-xs ${
          entry.faceMatch === 'matched' ? 'text-green-400' :
          entry.faceMatch === 'mismatch' ? 'text-red-400' : 'text-slate-400'
        }`}>
          {entry.faceMatch === 'matched' && <><CheckCircle className="w-3 h-3" /> Face verified — returning visitor</>}
          {entry.faceMatch === 'mismatch' && <><AlertTriangle className="w-3 h-3" /> Face mismatch flagged</>}
          {entry.faceMatch === 'new' && <><Eye className="w-3 h-3" /> First-time visitor — profile saved</>}
        </div>
      </div>

      {/* Live approval banner */}
      {isApproved && approvedEntry.qrToken ? (
        <div className="mb-5 p-4 rounded-xl bg-green-500/10 border border-green-500/30 animate-fade-in">
          <p className="text-green-400 font-semibold text-sm mb-3 flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" /> Resident Approved! QR Ready
          </p>
          <div className="flex gap-4 items-center justify-center">
            <div className="p-2 bg-white rounded-xl inline-block">
              <QRCodeSVG value={approvedEntry.qrToken} size={110} />
            </div>
            <div className="text-xs text-slate-400 space-y-1 text-left">
              <p>Show QR to visitor</p>
              <p>They scan → get OTP</p>
              <p>Enter OTP in <span className="text-indigo-400 font-medium">Scan QR tab</span></p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-5 flex items-center justify-center gap-2 text-xs text-amber-400 animate-pulse">
          <Clock className="w-3 h-3" /> Waiting for resident to approve...
        </div>
      )}

      <button onClick={onReset} className="btn-primary w-full justify-center">
        <Plus className="w-4 h-4" /> Log Another Visitor
      </button>
    </div>
  )
}

/* ─────────────────────────── SCAN TAB ─── */
function ScanTab({ user }) {
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef([])
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)

  const handleOtpChange = (idx, val) => {
    if (!/^\d*$/.test(val)) return  // digits only
    const newOtp = [...otpInput]
    newOtp[idx] = val.slice(-1)
    setOtpInput(newOtp)
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus()
  }

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otpInput[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const handleVerifyOTP = async () => {
    const token = otpInput.join('')
    if (token.length !== 6) {
      setResult({ status: 'error', message: 'Please enter a 6-digit OTP.' })
      return
    }
    try {
      setResult({ status: 'info', message: 'Verifying...' })
      const visitor = await verifyOtpToken(token, user.societyName)
      setResult({ status: 'success', message: `Visitor ${visitor.name} marked inside.` })
      setOtpInput(['', '', '', '', '', '']) // reset
    } catch (err) {
      setResult({ status: 'error', message: err.message })
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="glass-card p-5">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-400" /> QR Pass Scanner
        </h3>

        <div className="aspect-square max-w-sm mx-auto rounded-2xl bg-slate-900 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
          <div className="absolute inset-4 border-2 border-indigo-500/30 rounded-xl">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-500 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-indigo-500 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-indigo-500 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-500 rounded-br-lg" />
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-bounce" style={{ top: '50%' }} />
          </div>
          <ScanLine className="w-12 h-12 text-slate-600" />
          <div className="text-center z-10">
            <p className="text-sm text-slate-400">Point camera at QR code</p>
            <p className="text-xs text-slate-600 mt-1">Visitor's approved pass QR</p>
          </div>
        </div>
        <div className="mt-4 text-center">
          <button className="btn-primary" onClick={() => setScanning(!scanning)}>
            <Camera className="w-4 h-4" /> Open Camera Scanner
          </button>
        </div>

        {/* OTP Entry */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <p className="text-sm font-semibold text-white text-center mb-1">Enter 6-Digit OTP</p>
          <p className="text-[11px] text-slate-500 text-center mb-4">Visitor gets this OTP after scanning the QR shown on the guard screen</p>
          <div className="flex gap-2 max-w-xs mx-auto justify-center">
            {otpInput.map((val, i) => (
              <input
                key={i}
                ref={el => otpRefs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={val}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                className="input-field text-center text-xl font-bold w-11 h-13 p-0"
              />
            ))}
          </div>
          <div className="text-center mt-4">
            <button onClick={handleVerifyOTP} className="btn-primary text-sm py-2 px-6">
              <CheckCircle className="w-4 h-4" /> Verify & Mark Inside
            </button>
          </div>
          {result && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
              result.status === 'success' ? 'bg-green-500/15 border border-green-500/30 text-green-400' : 
              result.status === 'error' ? 'bg-red-500/15 border border-red-500/30 text-red-400' :
              result.status === 'info' ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400' :
              'bg-blue-500/15 border border-blue-500/30 text-blue-400'
            }`}>
              {result.status === 'success' && <CheckCircle className="w-4 h-4 inline mr-2" />}
              {result.status === 'error' && <XCircle className="w-4 h-4 inline mr-2" />}
              {result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── VISITORS TAB ─── */
function VisitorsTab({ user }) {
  const [visitors, setVisitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    if (!user?.societyName) return
    getAllVisitorsForSociety(user.societyName).then(v => {
      setVisitors(v)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user])

  const filters = ['All', 'Pending', 'Approved', 'Inside', 'Rejected', 'Exited']

  const filtered = visitors.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      v.name?.toLowerCase().includes(q) ||
      v.phone?.includes(q) ||
      v.flatGate?.toLowerCase().includes(q)

    const statusMap = {
      'Pending': 'pending', 'Approved': 'approved',
      'Inside': 'inside', 'Rejected': 'rejected', 'Exited': 'exited'
    }
    const matchFilter = filter === 'All' || v.status === statusMap[filter]
    return matchSearch && matchFilter
  })

  return (
    <div className="animate-fade-in space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name, phone, or flat..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Loading visitors...</p>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-slate-400 text-sm">No visitors found</p>
        </div>
      ) : (
        filtered.map(visitor => (
          <div key={visitor.id} className="glass-card p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {visitor.photo
                  ? <img src={visitor.photo} alt={visitor.name} className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold text-slate-500">{visitor.name?.charAt(0)}</span>
                }
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{visitor.name}</p>
                  <span className={`badge ${
                    visitor.status === 'pending' ? 'badge-warning' :
                    visitor.status === 'approved' ? 'badge-info' :
                    visitor.status === 'inside' ? 'badge-success' :
                    visitor.status === 'rejected' ? 'badge-danger' : 'badge-neutral'
                  }`}>
                    {visitor.status === 'inside' ? 'Inside' : getStatusLabel(visitor.status)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><Home className="w-3 h-3" />{visitor.flatGate}</span>
                  <span>{visitor.phone}</span>
                  <span>{visitor.purpose}</span>
                  <span>{getTimeAgo(visitor.entryTimestamp)}</span>
                </div>
                {visitor.faceMatch === 'mismatch' && (
                  <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Face mismatch recorded
                  </p>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
