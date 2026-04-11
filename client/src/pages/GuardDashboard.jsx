import { useState, useContext, useEffect, useRef, useMemo } from 'react'
import { AuthContext } from '../App'
import {
  Shield, LogOut, Plus, QrCode, Camera, AlertTriangle,
  CheckCircle, XCircle, Clock, Users, UserPlus, Search,
  Phone, Home, Eye, MapPin, Bell, X, Send, User,
  ScanLine, LogIn, DoorOpen, RefreshCw, MessageCircle,
  Mic, MicOff, Loader2
} from 'lucide-react'
import { getTimeAgo, getStatusColor, getStatusLabel } from '../data/mockData'
import { QRCodeSVG } from 'qrcode.react'
import { validatePhoneFormat } from '../utils/phoneValidation'
import {
  compressImageToBase64, lookupVisitorProfile, saveVisitorProfile,
  logVisitorEntry, markPreApprovedVisitorInside, getTodayEntries, markVisitorInside,
  markVisitorExit, getAllVisitorsForSociety, decryptPhoto,
  verifyOtpToken, checkIfSocietyMember, getPassById,
  getExpectedVisitorsForSociety, processEventPassScan
} from '../utils/visitorHelpers'
import { Html5QrcodeScanner } from 'html5-qrcode'
import VisitorChatModal from '../components/VisitorChatModal'
import { subscribeToUserNotifications, markNotificationRead, markAllNotificationsRead } from '../utils/notificationHelpers'

export default function GuardDashboard() {
  const { user, logout } = useContext(AuthContext)
  const [activeTab, setActiveTab] = useState('home')
  const [guardNotifications, setGuardNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const unreadCount = guardNotifications.filter(n => !n.read).length

  // Lift todayEntries to parent so polling runs regardless of active tab
  const [todayEntries, setTodayEntries] = useState([])
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [expectedVisitors, setExpectedVisitors] = useState([])

  useEffect(() => {
    if (!user?.societyName) return
    const load = () => {
      getTodayEntries(user.societyName)
        .then(entries => { setTodayEntries(entries); setEntriesLoading(false) })
        .catch(() => setEntriesLoading(false))
      getExpectedVisitorsForSociety(user.societyName)
        .then(setExpectedVisitors)
        .catch(console.error)
    }
    load()
    const interval = setInterval(load, 4000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (!user?.uid) return
    const unsub = subscribeToUserNotifications(user.uid, setGuardNotifications)
    return () => unsub()
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
            <button
              onClick={() => setShowNotifications(v => !v)}
              className="relative p-2 rounded-xl bg-slate-800/60 text-slate-400 hover:text-white transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                {user?.name?.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight">{user?.name?.split(' ')[0] || 'Guard'}</p>
                <p className="text-[10px] text-slate-500">Guard</p>
              </div>
              <button onClick={logout} className="p-2 rounded-xl text-slate-500 hover:text-red-400 transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Guard Notification Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowNotifications(false)}>
          <div className="absolute top-[60px] right-4 w-80 glass-card p-0 overflow-hidden animate-fade-in shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Notifications
                {unreadCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-[10px] text-white font-bold">{unreadCount} new</span>}
              </h3>
              {unreadCount > 0 && (
                <button onClick={() => markAllNotificationsRead(user.uid)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  Mark all done
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-800/50">
              {guardNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-10 h-10 text-slate-800 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">All caught up!</p>
                  <p className="text-slate-600 text-xs mt-1">Resident actions & chat alerts appear here</p>
                </div>
              ) : guardNotifications.map(n => {
                const typeConfig = {
                  chat_message:     { bg: 'bg-indigo-500/20',  icon: <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />, border: 'border-l-indigo-500' },
                  visitor_approved: { bg: 'bg-green-500/20',   icon: <CheckCircle className="w-3.5 h-3.5 text-green-400" />,    border: 'border-l-green-500'  },
                  visitor_rejected: { bg: 'bg-red-500/20',     icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,          border: 'border-l-red-500'    },
                  visitor_blocked:  { bg: 'bg-red-700/20',     icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,    border: 'border-l-red-700'    },
                }[n.type] || { bg: 'bg-slate-700', icon: <Bell className="w-3.5 h-3.5 text-slate-400" />, border: 'border-l-slate-600' }

                return (
                  <div key={n.id} className={`p-3 hover:bg-slate-800/40 transition-colors border-l-2 ${typeConfig.border} ${!n.read ? 'bg-indigo-500/5' : ''}`}>
                    <div className="flex gap-3 items-start">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${typeConfig.bg}`}>
                        {typeConfig.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium leading-snug">{n.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{getTimeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && (
                        <button
                          onClick={e => { e.stopPropagation(); markNotificationRead(n.id) }}
                          className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500 hover:bg-indigo-400 transition-colors mt-2"
                          title="Mark as done"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

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
        {activeTab === 'home' && <HomeTab user={user} todayEntries={todayEntries} expectedVisitors={expectedVisitors} loading={entriesLoading} setTodayEntries={setTodayEntries} onNavigate={setActiveTab} />}
        {activeTab === 'log' && <NewEntryTab user={user} todayEntries={todayEntries} onDone={() => setActiveTab('home')} />}
        {activeTab === 'scan' && <ScanTab user={user} />}
        {activeTab === 'visitors' && <VisitorsTab user={user} todayEntries={todayEntries} loading={entriesLoading} />}
      </main>

      {/* Panic Button */}
      <button className="panic-btn" title="Emergency Alert">
        <AlertTriangle className="w-7 h-7" />
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────── HOME TAB ─── */
function HomeTab({ user, todayEntries, expectedVisitors, loading, setTodayEntries, onNavigate }) {
  const pending = todayEntries.filter(v => v.status === 'pending')
  const inside = todayEntries.filter(v => v.status === 'inside')

  const handleStatusChange = (updatedId, newStatus) => {
    setTodayEntries(prev => prev.map(v => v.id === updatedId ? { ...v, status: newStatus } : v))
  }

  // Real-time alerts computed from today's entries
  const activeAlerts = useMemo(() => {
    if (!todayEntries || todayEntries.length === 0) return []
    const alertsMap = new Map()

    todayEntries.forEach(v => {
      // 1. Face Mismatch
      if (v.faceMatch === 'mismatch' || v.faceMatch === 'failed') {
        const id = `mismatch-${v.id}`
        alertsMap.set(id, {
          id, type: 'critical',
          title: 'Face Mismatch Detected',
          message: `"${v.name}" photo mismatch — Flat ${v.flatGate}.`,
          timestamp: v.entryTimestamp || new Date().toISOString(),
        })
      }

      // 2. Late Night Entry (12am–5am IST)
      if (v.entryTimestamp) {
        const d = new Date(v.entryTimestamp)
        const istHours = (d.getUTCHours() + 5.5) % 24
        if (istHours >= 0 && istHours < 5) {
          const id = `latenight-${v.id}`
          alertsMap.set(id, {
            id, type: 'warning',
            title: 'Late Night Entry',
            message: `"${v.name}" entered at ${d.toLocaleTimeString('en-IN')} → Flat ${v.flatGate}.`,
            timestamp: v.entryTimestamp,
          })
        }
      }
    })

    // 3. Multi-Flat Activity (same phone → multiple flats)
    const phoneMap = {}
    todayEntries.forEach(v => {
      if (!v.phone || !v.flatGate) return
      if (!phoneMap[v.phone]) phoneMap[v.phone] = { flats: new Set(), visitor: v }
      phoneMap[v.phone].flats.add(v.flatGate)
    })
    Object.entries(phoneMap).forEach(([phone, data]) => {
      if (data.flats.size > 1) {
        const id = `multi-${phone.replace(/\D/g, '')}`
        alertsMap.set(id, {
          id, type: 'warning',
          title: 'Multi-Flat Activity',
          message: `Phone ${phone} visited ${data.flats.size} flats: ${[...data.flats].join(', ')}.`,
          timestamp: data.visitor.entryTimestamp || new Date().toISOString(),
        })
      }
    })

    // 4. Repeated Rejections (same phone ≥ 2 rejections today)
    const rejectionMap = {}
    todayEntries.forEach(v => {
      if (v.status === 'rejected' && v.phone) {
        rejectionMap[v.phone] = (rejectionMap[v.phone] || 0) + 1
      }
    })
    Object.entries(rejectionMap).forEach(([phone, count]) => {
      if (count >= 2) {
        const id = `reject-${phone.replace(/\D/g, '')}`
        alertsMap.set(id, {
          id, type: 'critical',
          title: 'Repeated Rejections',
          message: `Phone ${phone} was rejected ${count} times today.`,
          timestamp: new Date().toISOString(),
        })
      }
    })

    return [...alertsMap.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [todayEntries])

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
          <p className="text-2xl font-bold text-white">{loading ? '—' : activeAlerts.filter(a => a.type === 'critical').length}</p>
          <p className="text-xs text-slate-500">Active Alerts</p>
        </div>
      </div>

      {/* Real-time Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Active Alerts</h3>
            <span className="ml-auto text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{activeAlerts.length} live</span>
          </div>
          <div className="space-y-2">
            {activeAlerts.map(alert => (
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
                  user={user}
                  onStatusChange={handleStatusChange}
                />
              ))}
          </div>
        )}
      </div>

      {/* Expected Visitors */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Expected Today
          </h3>
        </div>
        {!expectedVisitors || expectedVisitors.length === 0 ? (
          <div className="glass-card p-6 text-center border-dashed border-slate-700/50">
             <p className="text-slate-400 text-xs">No expected visitors log from residents.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expectedVisitors.map(ev => (
              <div key={ev.id} className="glass-card p-3 border-l-4 border-l-blue-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-white mb-0.5">{ev.name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1"><Home className="w-3 h-3 text-slate-500"/> {ev.flatGate}</p>
                    <p className="text-xs text-slate-400 mt-1">{ev.purpose} • {ev.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="badge badge-info text-[10px] mb-1 py-0.5">Expected</span>
                    <p className="text-[10px] text-blue-400 font-medium">{ev.timeWindow}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/* ─────────────────────────── ACTIVE VISITOR CARD ─── */
function ActiveVisitorCard({ visitor, user, onStatusChange }) {
  const [busy, setBusy] = useState(false)
  const [showChat, setShowChat] = useState(false)

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
                <p className="text-sm font-semibold text-white">
                  {visitor.name}
                  {visitor.type === 'event_visitor' && <span className="ml-2 bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">Event</span>}
                </p>
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
                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">{visitor.purpose}</span>
                <span>{getTimeAgo(visitor.entryTimestamp)}</span>
                <span>{visitor.phone}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 flex-wrap gap-2 pt-3 border-t border-slate-700/50">
            <div className="flex items-center gap-2">
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
            <button onClick={() => setShowChat(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors text-xs font-medium relative" title="Message Resident">
              <MessageCircle className="w-3.5 h-3.5" />
              Chat
              {visitor.messages?.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-[var(--color-dark)]" />}
            </button>
          </div>

          {/* QR Pass — auto-shown when approved, contains OTP for visitor to scan */}
          {visitor.status === 'approved' && visitor.qrToken && (
            <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
              <p className="text-xs text-indigo-400 mb-2 flex items-center gap-1">
                <QrCode className="w-3 h-3" /> Resident approved. Show QR to visitor to scan:
              </p>
              <div className="flex gap-4 items-center">
                <div className="p-2 bg-white rounded-xl inline-block">
                  <QRCodeSVG value={visitor.qrToken} size={100} />
                </div>
                <div className="text-sm font-medium text-slate-300 flex items-center pr-4">
                  <p>Scan QR Code to Verify</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showChat && (
        <VisitorChatModal 
          visitorId={visitor.id} 
          visitorName={visitor.name} 
          visitorFlat={visitor.flatGate}
          user={user} 
          onClose={() => setShowChat(false)} 
        />
      )}
    </div>
  )
}

/* ─────────────────────────── NEW ENTRY TAB ─── */
function NewEntryTab({ user, todayEntries, onDone }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(null)

  const [formData, setFormData] = useState({
    name: '', phone: '+91', purpose: '', flatGate: '', photo: null
  })
  
  // ── Webcam state ────────────────────────────────────────
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const startCamera = async () => {
    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCameraActive(true)
      }
    } catch (err) {
      console.error('Camera error:', err)
      setCameraError('Camera access denied. Please allow camera permissions.')
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const base64 = canvas.toDataURL('image/jpeg', 0.8)
      setFormData(prev => ({ ...prev, photo: base64 }))
      
      if (formData.phone.length > 5) {
        checkReturningVisitor(formData.phone)
      }
      stopCamera()
    }
  }

  const retakePhoto = () => {
    setFormData(prev => ({ ...prev, photo: null }))
    setReturningProfile(null)
    setFaceCheckDone(false)
    setFaceMatch('new')
    startCamera()
  }

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const [returningProfile, setReturningProfile] = useState(null)
  const [faceCheckDone, setFaceCheckDone] = useState(false)
  const [faceMatch, setFaceMatch] = useState('new')

  // ── Voice input state ──────────────────────────────────
  const [activeVoiceField, setActiveVoiceField] = useState(null) // which field is listening
  const recognitionRef = useRef(null)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  const startVoiceForField = (fieldName) => {
    if (!SpeechRecognition) { alert('Voice input requires Chrome or Edge.'); return }
    // Stop any existing session
    if (recognitionRef.current) { recognitionRef.current.stop() }
    if (activeVoiceField === fieldName) { setActiveVoiceField(null); return } // toggle off

    const rec = new SpeechRecognition()
    rec.lang = 'en-IN'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 3

    rec.onstart = () => setActiveVoiceField(fieldName)

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim()
      setFormData(prev => ({ ...prev, [fieldName]: transcript }))
      // For phone: normalize digits
      if (fieldName === 'phone') {
        const digits = transcript.replace(/\D/g, '')
        const normalized = digits.startsWith('91') && digits.length === 12
          ? '+' + digits
          : digits.length === 10 ? '+91' + digits : transcript
        setFormData(prev => ({ ...prev, phone: normalized }))
      }
      rec.stop()
    }

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') console.error('Voice error:', e.error)
      setActiveVoiceField(null)
    }
    rec.onend = () => setActiveVoiceField(null)

    recognitionRef.current = rec
    rec.start()
  }

  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])


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
      const isMember = await checkIfSocietyMember(user.societyName, formData.phone)
      if (isMember) {
        setError(`Cannot log entry: Phone number belongs to a registered ${isMember.role} of the society.`)
        setLoading(false)
        return
      }

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
        guardName: user.name,
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
    return <EntrySuccess entry={submitted} todayEntries={todayEntries} onReset={() => {
      setSubmitted(null)
      setFormData({ name: '', phone: '+91', purpose: '', flatGate: '', photo: null })
      setReturningProfile(null)
      setFaceCheckDone(false)
      setFaceMatch('new')
      startCamera()
    }} />
  }

  // Helper: mic button for each field
  const MicBtn = ({ field }) => (
    <button
      type="button"
      onClick={() => startVoiceForField(field)}
      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
        activeVoiceField === field
          ? 'text-red-400 bg-red-500/10 animate-pulse'
          : 'text-slate-500 hover:text-indigo-400 hover:bg-slate-700'
      }`}
      title={activeVoiceField === field ? 'Stop recording' : `Speak ${field}`}
    >
      {activeVoiceField === field ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
    </button>
  )

  return (
    <div className="animate-fade-in">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" /> Log New Visitor
          </h3>
          {SpeechRecognition && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Mic className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] text-indigo-400 font-medium">Voice enabled</span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Photo Webcam Capture */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Visitor Photo *</label>
            <div className="flex gap-4 items-start flex-col sm:flex-row">
              <div className="relative w-full sm:w-[280px] aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-700">
                {formData.photo ? (
                  <img src={formData.photo} alt="Visitor" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`} />
                    {!isCameraActive && !cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-xs">Starting camera...</span>
                      </div>
                    )}
                    {cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 bg-red-950/40 p-4 text-center">
                        <AlertTriangle className="w-6 h-6 mb-2" />
                        <span className="text-xs">{cameraError}</span>
                        <button type="button" onClick={startCamera} className="mt-2 text-xs text-red-300 underline">Try Again</button>
                      </div>
                    )}
                  </>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              <div className="flex-1 space-y-3 w-full">
                {formData.photo ? (
                  <button type="button" onClick={retakePhoto} className="btn-secondary w-full py-2.5 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 mr-2" /> Retake Photo
                  </button>
                ) : (
                  <button type="button" onClick={capturePhoto} disabled={!isCameraActive} className="btn-primary w-full py-2.5 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                    <Camera className="w-4 h-4 mr-2" /> Capture Photo
                  </button>
                )}
                <div className="text-xs text-slate-500">
                  <p>Capture a clear photo of the visitor.</p>
                  <p className="mt-1 text-slate-600 border-l-2 border-indigo-500 pl-2">Used for Face Verification on repeat visits.</p>
                </div>
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
                  className="input-field pl-10 pr-9"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
                <MicBtn field="name" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  className="input-field pl-10 pr-9"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  onBlur={handlePhoneBlur}
                  required
                />
                <MicBtn field="phone" />
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
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Guest, Delivery, Repair..."
                  className="input-field pr-9"
                  value={formData.purpose}
                  onChange={e => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                  required
                />
                <MicBtn field="purpose" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Flat Number *</label>
              <div className="relative">
                <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. A-302"
                  className="input-field pl-10 pr-9"
                  value={formData.flatGate}
                  onChange={e => setFormData(prev => ({ ...prev, flatGate: e.target.value }))}
                  required
                />
                <MicBtn field="flatGate" />
              </div>
            </div>
          </div>

          {activeVoiceField && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Listening for <span className="font-semibold capitalize">{activeVoiceField === 'flatGate' ? 'Flat Number' : activeVoiceField}</span>… speak clearly
            </div>
          )}

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
            <span>Entry Logged at - {new Date().toLocaleTimeString('en-IN')}</span>
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
function EntrySuccess({ entry, todayEntries, onReset }) {
  // Check real-time if this specific entry has been approved, rejected or blocked
  const currentEntry = todayEntries?.find(v => v.id === entry.id)
  const isApproved = currentEntry?.status === 'approved'
  const isRejected = currentEntry?.status === 'rejected'
  const isBlocked = currentEntry?.status === 'blocked'

  if (isRejected || isBlocked) {
    return (
      <div className="glass-card p-6 text-center animate-fade-in border border-red-500/30">
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Entry Denied</h3>
        <p className="text-sm text-slate-400 mb-6">
          The resident has <strong className="text-red-400">{isBlocked ? 'permanently blocked' : 'rejected'}</strong> this visitor. Access is not granted.
        </p>
        <button onClick={onReset} className="w-full btn-danger justify-center py-3">
          <RefreshCw className="w-4 h-4 mr-2" /> Log Another Visitor
        </button>
      </div>
    )
  }

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
      {isApproved && currentEntry?.qrToken ? (
        <div className="mb-5 p-4 rounded-xl bg-green-500/10 border border-green-500/30 animate-fade-in">
          <p className="text-green-400 font-semibold text-sm mb-3 flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" /> Resident Approved! QR Ready
          </p>
          <div className="flex gap-4 items-center justify-center">
            <div className="p-2 bg-white rounded-xl inline-block">
              <QRCodeSVG value={currentEntry.qrToken} size={110} />
            </div>
            <div className="text-sm font-medium text-slate-300 flex items-center pr-4">
              <p>Scan QR Code to Verify</p>
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
  const [scanResult, setScanResult] = useState(null)
  const [otpResult, setOtpResult] = useState(null)
  const scannerRef = useRef(null)
  const isProcessingRef = useRef(false) // prevents concurrent scans

  useEffect(() => {
    if (scanning) {
      isProcessingRef.current = false // reset on new scan
      if (!scannerRef.current) {
        setScanResult({ status: 'info', message: 'Initializing camera...' })
        import('html5-qrcode').then(({ Html5Qrcode }) => {
          Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length) {
              const html5QrCode = new Html5Qrcode("qr-reader")
              scannerRef.current = html5QrCode
              html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                onScanSuccess,
                onScanFailure
              )
            } else {
              setScanResult({ status: 'error', message: 'No cameras found on your device.' })
              setScanning(false)
            }
          }).catch(err => {
            setScanResult({ status: 'error', message: 'Camera permission denied or camera not found.' })
            setScanning(false)
          })
        })
      }
    } else {
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => {
          scannerRef.current.clear()
          scannerRef.current = null
        }).catch(err => console.log(err))
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => {
          scannerRef.current.clear()
          scannerRef.current = null
        }).catch(err => console.log(err))
      }
    }
  }, [scanning])

  const onScanSuccess = async (decodedText, decodedResult) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    if (scannerRef.current) {
      scannerRef.current.pause()
    }
    setScanResult({ status: 'info', message: 'Verifying Pass...' })
    
    try {
      const pass = await getPassById(decodedText)
      
      if (!pass) {
        throw new Error("this is not a valid qr get a valid qr")
      }
      
      const now = new Date()
      const validFrom = new Date(pass.validFrom)
      const validUntil = new Date(pass.validUntil)
      
      if (now < validFrom) {
        throw new Error(`Pass is not valid yet (Starts ${validFrom.toLocaleString()}).`)
      }
      if (now > validUntil) {
        throw new Error(`qr is expired please make new (Ended ${validUntil.toLocaleString()})`)
      }

      if (pass.type === 'event_pass') {
        setScanResult({ status: 'info', message: 'Logging event visitor...' })
        await processEventPassScan(pass, user.uid, user.name)
        setScanResult({ status: 'success', message: `Event Guest Approved for ${pass.eventName}` })
      } else {
        if (pass.status !== 'pre_approved_active') {
          throw new Error(`Pass is inactive or has already been used.`)
        }
        setScanResult({ status: 'info', message: 'Logging visitor...' })
        await markPreApprovedVisitorInside(decodedText, user.uid, user.name)
        setScanResult({ status: 'success', message: `${pass.name} Approved` })
      }
    } catch (err) {
      setScanResult({ status: 'error', message: err.message })
    } finally {
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => {
          scannerRef.current.clear()
          scannerRef.current = null
          setScanning(false)
        }).catch(() => setScanning(false))
      } else {
        setScanning(false)
      }
    }
  }

  const onScanFailure = (error) => {
    // handle scan failure, usually better to ignore and keep scanning
  }

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
      setOtpResult({ status: 'error', message: 'Please enter a 6-digit OTP.' })
      return
    }
    try {
      setOtpResult({ status: 'info', message: 'Verifying OTP...' })
      const visitor = await verifyOtpToken(token, user.societyName)
      setOtpResult({ status: 'success', message: `Visitor ${visitor.name} marked inside.` })
      setOtpInput(['', '', '', '', '', '']) // reset
    } catch (err) {
      setOtpResult({ status: 'error', message: err.message })
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="glass-card p-5">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-400" /> QR Pass Scanner
        </h3>

        {!scanning ? (
          <div className="aspect-square max-w-sm mx-auto rounded-2xl bg-slate-900 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
            {scanResult ? (
              <div className={`p-6 text-center animate-fade-in ${
                scanResult.status === 'success' ? 'text-green-400' : 
                scanResult.status === 'error' ? 'text-red-400' : 'text-blue-400'
              }`}>
                {scanResult.status === 'success' && <CheckCircle className="w-16 h-16 mx-auto mb-4" />}
                {scanResult.status === 'error' && <XCircle className="w-16 h-16 mx-auto mb-4" />}
                <p className="font-semibold text-lg">{scanResult.message}</p>
              </div>
            ) : (
              <>
                <ScanLine className="w-12 h-12 text-slate-600" />
                <div className="text-center z-10">
                  <p className="text-sm text-slate-400">Point camera at QR code</p>
                  <p className="text-xs text-slate-600 mt-1">Visitor's approved pass QR</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="max-w-sm mx-auto overflow-hidden rounded-2xl border-2 border-indigo-500">
            <div id="qr-reader" className="w-full bg-slate-900"></div>
          </div>
        )}

        <div className="mt-4 text-center">
          <button className={scanning ? 'btn-danger' : 'btn-primary'} onClick={() => {
            setScanning(!scanning)
            if (scanning) setScanResult(null)
          }}>
            <Camera className="w-4 h-4" /> {scanning ? 'Stop Camera' : 'Open Camera Scanner'}
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
          {otpResult && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
              otpResult.status === 'success' ? 'bg-green-500/15 border border-green-500/30 text-green-400' : 
              otpResult.status === 'error' ? 'bg-red-500/15 border border-red-500/30 text-red-400' :
              otpResult.status === 'info' ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400' :
              'bg-blue-500/15 border border-blue-500/30 text-blue-400'
            }`}>
              {otpResult.status === 'success' && <CheckCircle className="w-4 h-4 inline mr-2" />}
              {otpResult.status === 'error' && <XCircle className="w-4 h-4 inline mr-2" />}
              {otpResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── VISITORS TAB ─── */
function VisitorsTab({ user, todayEntries, loading }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const filters = ['All', 'Pending', 'Approved', 'Inside', 'Rejected', 'Exited']

  const filtered = (todayEntries || []).filter(v => {
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
                {visitor.status === 'inside' && (
                  <div className="mt-3 flex justify-end">
                    <button 
                      onClick={async () => {
                        if (confirm(`Mark ${visitor.name} as exited?`)) {
                          try {
                            await markVisitorExit(visitor.id)
                            alert('Visitor exited successfully.')
                          } catch (e) {
                            alert('Error updating exit status.')
                          }
                        }
                      }}
                      className="btn-outline py-1 px-3 text-xs text-slate-400 hover:text-white"
                    >
                      Mark Exit
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
