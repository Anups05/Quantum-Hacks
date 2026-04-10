import { useState, useContext } from 'react'
import { AuthContext } from '../App'
import {
  Shield, LogOut, Plus, QrCode, Camera, Mic, AlertTriangle,
  CheckCircle, XCircle, Clock, Users, UserPlus, Search,
  ChevronDown, Phone, Home, Eye, MessageCircle, MapPin,
  Bell, Menu, X, Send, Truck, User, FileText
} from 'lucide-react'
import {
  mockVisitors, mockAlerts, formatTime, getTimeAgo,
  getStatusColor, getStatusLabel, getRiskBadge, getTrustColor
} from '../data/mockData'
import { QRCodeSVG } from 'qrcode.react'

export default function GuardDashboard() {
  const { user, logout } = useContext(AuthContext)
  const [activeTab, setActiveTab] = useState('home')
  const [showVisitorForm, setShowVisitorForm] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [showChat, setShowChat] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedPurpose, setSelectedPurpose] = useState('Guest')
  const [showDeliveryPlatform, setShowDeliveryPlatform] = useState(false)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [voiceListening, setVoiceListening] = useState(false)
  const [notifications, setNotifications] = useState(3)

  const activeVisitors = mockVisitors.filter(v => ['pending', 'approved', 'checked_in'].includes(v.status))
  const recentVisitors = mockVisitors

  const tabs = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'log', label: 'New Entry', icon: UserPlus },
    { id: 'scan', label: 'Scan QR', icon: QrCode },
    { id: 'visitors', label: 'Visitors', icon: Users },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-dark)]">
      {/* Top Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden text-slate-400 p-1">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white leading-tight">SecureGate</h1>
                <p className="text-[10px] text-slate-500">{user.gate} • Guard Panel</p>
              </div>
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
                {user.avatar}
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
                onClick={() => { setActiveTab(tab.id); setShowVisitorForm(tab.id === 'log'); setShowQRScanner(tab.id === 'scan') }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 pb-24 space-y-4">
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-xs text-slate-500">Today</span>
                </div>
                <p className="text-2xl font-bold text-white">24</p>
                <p className="text-xs text-slate-500">Total Visitors</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-xs text-slate-500">Waiting</span>
                </div>
                <p className="text-2xl font-bold text-white">{activeVisitors.filter(v => v.status === 'pending').length}</p>
                <p className="text-xs text-slate-500">Pending Approval</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-xs text-slate-500">Active</span>
                </div>
                <p className="text-2xl font-bold text-white">8</p>
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

            {/* Active Alerts */}
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

            {/* Active Visitor Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" /> Active Visitors
                </h3>
                <button onClick={() => setActiveTab('log')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> New Entry
                </button>
              </div>
              <div className="space-y-3">
                {activeVisitors.map(visitor => (
                  <VisitorCard key={visitor.id} visitor={visitor} onChat={() => setShowChat(visitor.id)} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* NEW ENTRY TAB */}
        {activeTab === 'log' && (
          <div className="animate-fade-in">
            {formSubmitted ? (
              <FormResult onReset={() => setFormSubmitted(false)} />
            ) : (
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-400" /> Log New Visitor
                  </h3>
                  <button
                    onClick={() => setVoiceListening(!voiceListening)}
                    className={`p-2.5 rounded-xl border transition-all ${
                      voiceListening
                        ? 'bg-red-500/15 border-red-500/30 text-red-400'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                    title="Voice Entry"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                </div>

                {voiceListening && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 pulse-dot" />
                    <p className="text-sm text-red-300">Listening... "Visitor for Flat 302, name Rahul, purpose guest"</p>
                  </div>
                )}

                <form onSubmit={(e) => { e.preventDefault(); setFormSubmitted(true) }} className="space-y-4">
                  {/* Photo Capture */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Visitor Photo</label>
                    <div className="flex gap-3">
                      <div className="w-24 h-24 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                        <div className="text-center">
                          <Camera className="w-6 h-6 text-slate-600 mx-auto" />
                          <p className="text-[10px] text-slate-600 mt-1">No photo</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button type="button" className="btn-primary text-xs py-2 px-3">
                          <Camera className="w-3.5 h-3.5" /> Capture Photo
                        </button>
                        <p className="text-[10px] text-slate-500">Live camera snap required</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5">Visitor Name *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input type="text" placeholder="Full name" className="input-field pl-10" required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5">Phone Number *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input type="tel" placeholder="+91 98765 43210" className="input-field pl-10" required />
                      </div>
                      {/* Fake number detection hint */}
                      <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Phone number verified
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5">Purpose of Visit *</label>
                      <select
                        className="input-field appearance-none"
                        value={selectedPurpose}
                        onChange={(e) => {
                          setSelectedPurpose(e.target.value)
                          setShowDeliveryPlatform(e.target.value === 'Delivery')
                        }}
                      >
                        <option value="Guest">Guest</option>
                        <option value="Delivery">Delivery</option>
                        <option value="Service">Service</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5">Flat Number *</label>
                      <div className="relative">
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input type="text" placeholder="e.g. A-302" className="input-field pl-10" required />
                      </div>
                    </div>
                  </div>

                  {/* Delivery Platform Sub-form */}
                  {showDeliveryPlatform && (
                    <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                      <label className="block text-sm text-slate-400 mb-2">
                        <Truck className="w-4 h-4 inline mr-1" /> Delivery Platform
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Amazon', 'Swiggy', 'Zomato', 'Flipkart', 'Dunzo', 'Other'].map(platform => (
                          <button key={platform} type="button" className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 hover:border-indigo-500 hover:text-indigo-400 transition-all">
                            {platform}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Geo location indicator */}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-green-400" />
                    <span>Location auto-captured: 28.6139°N, 77.2090°E (Main Gate)</span>
                  </div>

                  <button type="submit" className="w-full btn-primary justify-center py-3">
                    <Send className="w-4 h-4" /> Submit & Notify Resident
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* QR SCANNER TAB */}
        {activeTab === 'scan' && (
          <div className="animate-fade-in">
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-400" /> QR Pass Scanner
              </h3>
              <div className="aspect-square max-w-sm mx-auto rounded-2xl bg-slate-900 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                {/* Scanner overlay */}
                <div className="absolute inset-4 border-2 border-indigo-500/30 rounded-xl">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-500 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-indigo-500 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-indigo-500 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-500 rounded-br-lg" />
                  {/* Scanning line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-bounce" style={{ top: '50%' }} />
                </div>
                <Camera className="w-12 h-12 text-slate-600" />
                <div className="text-center z-10">
                  <p className="text-sm text-slate-400">Point camera at QR code</p>
                  <p className="text-xs text-slate-600 mt-1">Visitor's approved pass QR</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <button className="btn-primary">
                  <Camera className="w-4 h-4" /> Open Camera Scanner
                </button>
              </div>

              {/* Manual OTP Entry */}
              <div className="mt-6 pt-4 border-t border-slate-800">
                <p className="text-sm text-slate-400 text-center mb-3">Or enter OTP manually</p>
                <div className="flex gap-2 max-w-xs mx-auto">
                  {[...Array(6)].map((_, i) => (
                    <input key={i} type="text" maxLength={1} className="input-field text-center text-lg font-bold w-12 h-12" />
                  ))}
                </div>
                <div className="text-center mt-3">
                  <button className="btn-outline text-sm py-2">Verify OTP</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISITORS TAB */}
        {activeTab === 'visitors' && (
          <div className="animate-fade-in space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Search visitors by name, phone, or flat..." className="input-field pl-10" />
            </div>

            {/* Filter tags */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['All', 'Pending', 'Approved', 'Inside', 'Rejected', 'Exited'].map(filter => (
                <button key={filter} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  filter === 'All' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}>{filter}</button>
              ))}
            </div>

            {/* Visitor List */}
            {recentVisitors.map(visitor => (
              <VisitorCard key={visitor.id} visitor={visitor} showFull onChat={() => setShowChat(visitor.id)} />
            ))}
          </div>
        )}
      </main>

      {/* Chat overlay */}
      {showChat && <ChatOverlay visitorId={showChat} onClose={() => setShowChat(null)} />}

      {/* Panic Button */}
      <button className="panic-btn" title="Emergency Alert">
        <AlertTriangle className="w-7 h-7" />
      </button>
    </div>
  )
}

function VisitorCard({ visitor, showFull, onChat }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="glass-card-hover p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 text-lg font-bold text-slate-500">
          {visitor.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-white">{visitor.name}</p>
                <span className={`badge ${getStatusColor(visitor.status)}`}>{getStatusLabel(visitor.status)}</span>
                {visitor.isDelivery && <span className="badge badge-info"><Truck className="w-3 h-3" />{visitor.platform}</span>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Home className="w-3 h-3" />{visitor.flat}</span>
                <span>{visitor.purpose}</span>
                <span>{getTimeAgo(visitor.timestamp)}</span>
              </div>
            </div>
            {/* Risk Badge */}
            <span className={`badge ${getRiskBadge(visitor.riskLevel)} flex-shrink-0`}>
              {visitor.riskLevel === 'High' && <AlertTriangle className="w-3 h-3" />}
              {visitor.riskLevel}
            </span>
          </div>

          {/* Trust Score Bar */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-slate-500">Trust</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${visitor.trustScore}%`, backgroundColor: getTrustColor(visitor.trustScore) }}
              />
            </div>
            <span className="text-xs font-medium" style={{ color: getTrustColor(visitor.trustScore) }}>
              {visitor.trustScore}
            </span>
          </div>

          {/* Face match */}
          {visitor.faceMatch && (
            <div className={`mt-1.5 flex items-center gap-1 text-[10px] ${
              visitor.faceMatch === 'matched' ? 'text-green-400' : visitor.faceMatch === 'mismatch' ? 'text-red-400' : 'text-slate-500'
            }`}>
              {visitor.faceMatch === 'matched' ? <CheckCircle className="w-3 h-3" /> :
               visitor.faceMatch === 'mismatch' ? <AlertTriangle className="w-3 h-3" /> :
               <Eye className="w-3 h-3" />}
              {visitor.faceMatch === 'matched' ? 'Face verified' :
               visitor.faceMatch === 'mismatch' ? 'FACE MISMATCH — Different person!' :
               'First-time visitor'}
            </div>
          )}

          {/* Risk Reason */}
          {visitor.riskLevel !== 'Low' && visitor.riskReason && (
            <p className="mt-1 text-[10px] text-amber-400/80 bg-amber-500/5 px-2 py-1 rounded">
              ⚠ {visitor.riskReason}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {visitor.status === 'pending' && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Waiting for resident approval...
              </span>
            )}
            {visitor.status === 'approved' && (
              <button className="btn-success text-xs py-1.5 px-3">
                <QrCode className="w-3 h-3" /> Scan QR to Enter
              </button>
            )}
            {visitor.status === 'checked_in' && (
              <button className="btn-outline text-xs py-1.5 px-3">
                <LogOut className="w-3 h-3" /> Mark Exit
              </button>
            )}
            <button onClick={onChat} className="btn-outline text-xs py-1.5 px-3">
              <MessageCircle className="w-3 h-3" /> Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormResult({ onReset }) {
  return (
    <div className="glass-card p-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-green-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Visitor Logged Successfully</h3>
      <p className="text-sm text-slate-400 mb-4">Notification sent to resident. Awaiting approval.</p>

      {/* AI Risk Badge Result */}
      <div className="glass-card p-4 mb-4 text-left">
        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">AI Risk Assessment</p>
        <div className="flex items-center gap-3">
          <span className="badge badge-success text-sm">Low Risk</span>
          <p className="text-sm text-slate-300">First-time visitor with verified phone number. No suspicious patterns detected.</p>
        </div>
      </div>

      {/* Generated QR Preview */}
      <div className="glass-card p-4 mb-4">
        <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Visitor Pass (Generated on Approval)</p>
        <div className="w-40 h-40 mx-auto bg-white rounded-xl p-3 flex items-center justify-center">
          <QRCodeSVG value="securegate://visitor/v-new-001?token=demo" size={128} />
        </div>
        <p className="text-xs text-slate-500 mt-2">Valid for 30 minutes after approval</p>
      </div>

      <button onClick={onReset} className="btn-primary">
        <Plus className="w-4 h-4" /> Log Another Visitor
      </button>
    </div>
  )
}

function ChatOverlay({ visitorId, onClose }) {
  const [message, setMessage] = useState('')

  const messages = [
    { sender: 'guard', text: 'There is a guest at the gate for your flat. He says he is your cousin.', time: '4 min ago' },
    { sender: 'resident', text: "Can you ask him my mother's name for verification?", time: '3 min ago' },
    { sender: 'guard', text: 'He said "Sunita ji". Is that correct?', time: '2 min ago' },
    { sender: 'resident', text: "Yes, that's correct. Please let him in.", time: '1 min ago' },
  ]

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end lg:items-center justify-center p-4">
      <div className="glass-card w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Chat with Resident</h3>
            <p className="text-xs text-slate-500">Re: Visitor at gate</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === 'guard' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.sender === 'guard'
                  ? 'bg-indigo-500/20 text-indigo-100 rounded-br-md'
                  : 'bg-slate-800 text-slate-200 rounded-bl-md'
              }`}>
                <p className="text-sm">{msg.text}</p>
                <p className="text-[10px] text-slate-500 mt-1">{msg.time}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="input-field flex-1"
            />
            <button className="btn-primary px-3">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
