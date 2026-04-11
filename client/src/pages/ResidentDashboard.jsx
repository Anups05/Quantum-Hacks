import { useState, useContext, useEffect, useMemo } from 'react'
import { AuthContext } from '../App'
import {
  Shield, LogOut, Bell, Home, Clock, Users, History, Settings,
  CheckCircle, XCircle, AlertTriangle, QrCode, Plus, Search,
  Phone, User, Calendar, ChevronRight, Eye, MessageCircle,
  Ban, List, UserPlus, Trash2, Edit, Pause, Play, X, Send,
  Truck, MapPin, Share2, Camera
} from 'lucide-react'
import {
  mockVisitors, mockRecurringPasses, mockExpectedVisitors,
  mockBlocklist, mockWatchlist, formatTime, formatDate, formatDateTime,
  getTimeAgo, getStatusColor, getStatusLabel, getRiskBadge, getTrustColor
} from '../data/mockData'
import { QRCodeCanvas } from 'qrcode.react'
import { db } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { validatePhoneFormat, checkPhoneUnique } from '../utils/phoneValidation'
import {
  subscribeToUserNotifications, markNotificationRead, markAllNotificationsRead,
  notifyGuardVisitorApproved, notifyGuardVisitorRejected, notifyGuardVisitorBlocked
} from '../utils/notificationHelpers'
import {
  getPendingVisitorsForFlat, getVisitorHistoryForFlat,
  approveVisitor, rejectVisitor, blockVisitor, getTodayEntries,
  createPreApprovedPass, compressImageToBase64,
  getPreApprovedPassesForFlat, deletePreApprovedPass,
  getExpectedVisitorsForFlat, createExpectedVisitor,
  getBlockedVisitorsByFlat, unblockVisitor, removeVisitorEntry
} from '../utils/visitorHelpers'
import VisitorChatModal from '../components/VisitorChatModal'

export default function ResidentDashboard() {
  const { user, setUser, logout } = useContext(AuthContext)
  const [profileData, setProfileData] = useState({
    name: user.name || '',
    phoneNumber: user.phoneNumber || ''
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('home')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPreApprove, setShowPreApprove] = useState(false)
  const [showChat, setShowChat] = useState(null)
  const [showQR, setShowQR] = useState(null)
  const [notifications, setNotifications] = useState([])
  const unreadCount = notifications.filter(n => !n.read).length

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setProfileLoading(true)
    setProfileError('')
    setProfileSuccess('')
    try {
      if (!validatePhoneFormat(profileData.phoneNumber)) {
        throw new Error('Phone number must be +91 followed by 10 digits.')
      }
      const isUnique = await checkPhoneUnique(profileData.phoneNumber, user.uid)
      if (!isUnique) {
        throw new Error('This phone number is already registered to another account.')
      }
      await updateDoc(doc(db, 'users', user.uid), profileData)
      setUser({ ...user, ...profileData })
      setProfileSuccess("Profile updated successfully")
    } catch(err) {
      console.error(err)
      setProfileError(err.message)
    } finally {
      setProfileLoading(false)
    }
  }

  const [pendingVisitors, setPendingVisitors] = useState([])
  const [visitHistory, setVisitHistory] = useState([])
  const [todayEntries, setTodayEntries] = useState([])
  const [activePasses, setActivePasses] = useState([])
  const [loadingVisitors, setLoadingVisitors] = useState(true)

  // History tab filtering
  const [historySearch, setHistorySearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState('All')

  // History export function
  const handleExportHistory = async () => {
    try {
      const xlsx = await import('xlsx');
      const exportData = filteredHistory.map(v => ({
        Date: new Date(v.entryTimestamp).toLocaleDateString('en-IN'),
        Time: new Date(v.entryTimestamp).toLocaleTimeString('en-IN'),
        Name: v.name,
        Phone: v.phone,
        Purpose: v.purpose,
        Status: v.status,
        Flat: v.flatGate
      }));
      
      const worksheet = xlsx.utils.json_to_sheet(exportData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Visitor History");
      xlsx.writeFile(workbook, `visitor_history_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error("Export failed: ", e);
    }
  }

  // Filtered history
  const filteredHistory = visitHistory.filter(v => {
    const q = historySearch.toLowerCase()
    const matchSearch = !q || v.name?.toLowerCase().includes(q) || v.phone?.includes(q)
    const filterMap = {
      'Pending': 'pending', 'Approved': 'approved', 
      'Rejected': 'rejected', 'Entered': 'inside', 'Exited': 'exited'
    }
    const matchFilter = historyFilter === 'All' || v.status === filterMap[historyFilter]
    return matchSearch && matchFilter
  })

  const [showExpectedModal, setShowExpectedModal] = useState(false)
  const [expectedVisitors, setExpectedVisitors] = useState([])
  const [chatVisitor, setChatVisitor] = useState(null)
  const [blockedVisitors, setBlockedVisitors] = useState([])
  const [loadingBlocked, setLoadingBlocked] = useState(false)

  // Resident-Specific Real-time Security Alerts
  const activeAlerts = useMemo(() => {
    if (!user?.flatGate) return []
    const alertsMap = new Map()
    const allRelevantVisitors = [...visitHistory, ...todayEntries]

    allRelevantVisitors.forEach(v => {
      // 1. Face Mismatch targeting their flat
      if (v.faceMatch === 'mismatch' || v.faceMatch === 'failed') {
        const id = `mismatch-${v.id}`
        alertsMap.set(id, {
          id, type: 'critical', title: 'Face Mismatch Detected',
          message: `Visitor "${v.name}" had a face mismatch while attempting to visit your flat.`,
          timestamp: v.entryTimestamp || new Date().toISOString()
        })
      }

      // 2. Late Night Entry to their flat
      if (v.entryTimestamp) {
        const date = new Date(v.entryTimestamp)
        const istHours = (date.getUTCHours() + 5.5) % 24
        if (istHours >= 0 && istHours < 5) {
          const id = `latenight-${v.id}`
          alertsMap.set(id, {
            id, type: 'warning', title: 'Late Night Entry',
            message: `Visitor "${v.name}" entered at ${date.toLocaleTimeString()} to your flat.`,
            timestamp: v.entryTimestamp
          })
        }
      }
    })

    // 3. Repeated Rejections to their flat
    const phoneRejections = {}
    allRelevantVisitors.forEach(v => {
      if (v.status === 'rejected' && v.phone) {
        if (!phoneRejections[v.phone]) phoneRejections[v.phone] = []
        phoneRejections[v.phone].push(v)
      }
    })

    Object.entries(phoneRejections).forEach(([phone, rejections]) => {
      if (rejections.length >= 2) {
        rejections.sort((a, b) => new Date(b.entryTimestamp) - new Date(a.entryTimestamp))
        const lastRejection = rejections[0]
        const id = `rej-${phone.replace(/\D/g, '')}`
        alertsMap.set(id, {
          id, type: 'warning', title: 'Repeated Visitor Rejections',
          message: `Phone ${phone} (${lastRejection.name || 'Unknown'}) was rejected ${rejections.length} times attempting to visit you.`,
          timestamp: lastRejection.entryTimestamp || new Date().toISOString()
        })
      }
    })

    // Exclude old alerts (e.g. older than 24 hours) to keep dashboard clean
    const recentAlerts = Array.from(alertsMap.values()).filter(a => {
      return (new Date() - new Date(a.timestamp)) < (24 * 60 * 60 * 1000)
    })
    return recentAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [visitHistory, todayEntries, user?.flatGate])

  // Load real visitor data
  useEffect(() => {
    if (!user?.societyName || !user?.flatGate) return
    const load = async () => {
      try {
        const safeFlat = user.flatGate.trim().toUpperCase()
        const [pending, history, today, passes, expected] = await Promise.all([
          getPendingVisitorsForFlat(user.societyName, safeFlat),
          getVisitorHistoryForFlat(user.societyName, safeFlat),
          getTodayEntries(user.societyName),
          getPreApprovedPassesForFlat(user.societyName, safeFlat),
          getExpectedVisitorsForFlat(user.societyName, safeFlat)
        ])
        setPendingVisitors(pending)
        setVisitHistory(history)
        setTodayEntries(today.filter(v => v.flatGate === safeFlat || v.flatGate === user.flatGate))
        setActivePasses(passes)
        setExpectedVisitors(expected)
      } catch(e) { console.error(e) } finally { setLoadingVisitors(false) }
    }
    load()
  }, [user, showPreApprove, showExpectedModal])

  // Load blocked visitors separately
  useEffect(() => {
    if (!user?.societyName || !user?.flatGate) return
    const loadBlocked = async () => {
      setLoadingBlocked(true)
      try {
        const safeFlat = user.flatGate.trim().toUpperCase()
        const blocked = await getBlockedVisitorsByFlat(user.societyName, safeFlat)
        setBlockedVisitors(blocked)
      } catch(e) { console.error(e) } finally { setLoadingBlocked(false) }
    }
    loadBlocked()
  }, [user])

  // Real-time notification subscription
  useEffect(() => {
    if (!user?.uid) return
    const unsub = subscribeToUserNotifications(user.uid, setNotifications)
    return () => unsub()
  }, [user])

  const handleApprove = async (visitorId) => {
    const visitor = pendingVisitors.find(v => v.id === visitorId)
    await approveVisitor(visitorId, user.name)
    setPendingVisitors(prev => prev.filter(v => v.id !== visitorId))
    const updated = await getVisitorHistoryForFlat(user.societyName, user.flatGate.trim().toUpperCase())
    setVisitHistory(updated)
    // Notify guard
    if (visitor?.enteredBy) {
      notifyGuardVisitorApproved({
        societyName: user.societyName,
        guardUid: visitor.enteredBy,
        visitorName: visitor.name,
        residentName: user.name,
        flatGate: user.flatGate,
        visitorId,
      }).catch(console.error)
    }
  }

  const handleReject = async (visitorId) => {
    const visitor = pendingVisitors.find(v => v.id === visitorId)
    await rejectVisitor(visitorId)
    setPendingVisitors(prev => prev.filter(v => v.id !== visitorId))
    if (visitor?.enteredBy) {
      notifyGuardVisitorRejected({
        societyName: user.societyName,
        guardUid: visitor.enteredBy,
        visitorName: visitor.name,
        residentName: user.name,
        flatGate: user.flatGate,
        visitorId,
      }).catch(console.error)
    }
  }

  const handleBlock = async (visitorId, visitorData) => {
    const visitor = pendingVisitors.find(v => v.id === visitorId)
    await blockVisitor(visitorId, visitorData)
    setPendingVisitors(prev => prev.filter(v => v.id !== visitorId))
    if (visitor?.enteredBy) {
      notifyGuardVisitorBlocked({
        societyName: user.societyName,
        guardUid: visitor.enteredBy,
        visitorName: visitor.name,
        residentName: user.name,
        flatGate: user.flatGate,
        visitorId,
      }).catch(console.error)
    }
  }

  const [viewQrId, setViewQrId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  
  const downloadViewedQR = (passName) => {
    const canvas = document.getElementById('view-qr-canvas')
    if (canvas) {
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = `visitor-pass-${passName}.png`
      link.click()
    }
  }

  const handleDeletePass = async (passId) => {
    await deletePreApprovedPass(passId)
    setActivePasses(prev => prev.filter(p => p.id !== passId))
    setDeleteConfirmId(null)
  }

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle, badge: pendingVisitors.length },
    { id: 'history', label: 'History', icon: History },
    { id: 'passes', label: 'Passes', icon: QrCode },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  if (user?.status === 'pending') {
    return (
      <div className="min-h-screen bg-[var(--color-dark)] flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 text-center animate-fade-in">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Waiting for Approval</h2>
          <p className="text-slate-400 mb-8">
            Your account is currently pending verification from the Society Admin of <span className="font-semibold text-white">{user.societyName}</span>. 
            You will be granted access once approved.
          </p>
          <button onClick={logout} className="p-3 w-full rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-colors">
            Logout
          </button>
        </div>
      </div>
    )
  }

  if (user?.status === 'rejected') {
    return (
      <div className="min-h-screen bg-[var(--color-dark)] flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 text-center animate-fade-in border border-red-500/20">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Account Rejected</h2>
          <p className="text-slate-400 mb-8">
            The Society Admin of <span className="font-semibold text-white">{user.societyName}</span> has rejected your verification request.
          </p>
          <button onClick={logout} className="p-3 w-full rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all">
            Update Details & Reapply
          </button>
          <button onClick={logout} className="mt-3 p-3 w-full rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-colors">
            Logout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-dark)]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">SecureGate</h1>
              <p className="text-[10px] text-slate-500">Flat {user.flatGate || user.flat} • Resident</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
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
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">
                {user?.name?.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight">{user?.name?.split(' ')[0] || 'Resident'}</p>
                <p className="text-[10px] text-slate-500">Flat {user.flatGate || user.flat}</p>
              </div>
              <button onClick={logout} className="p-2 rounded-xl text-slate-500 hover:text-red-400 transition-colors">
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
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Notification Dropdown */}
      {showNotifications && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowNotifications(false)}>
          <div className="absolute top-[60px] right-4 w-80 glass-card p-0 overflow-hidden animate-fade-in shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Notifications
                {unreadCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-[10px] text-white font-bold">{unreadCount} new</span>}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllNotificationsRead(user.uid)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Mark all done
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-800/50">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-10 h-10 text-slate-800 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">All caught up!</p>
                  <p className="text-slate-600 text-xs mt-1">Visitor & chat alerts appear here</p>
                </div>
              ) : notifications.map(n => {
                const typeConfig = {
                  visitor_entry:    { bg: 'bg-amber-500/20',  icon: <Users className="w-3.5 h-3.5 text-amber-400" />,       border: 'border-l-amber-500' },
                  chat_message:     { bg: 'bg-indigo-500/20', icon: <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />, border: 'border-l-indigo-500' },
                  visitor_approved: { bg: 'bg-green-500/20',  icon: <CheckCircle className="w-3.5 h-3.5 text-green-400" />,   border: 'border-l-green-500' },
                  visitor_rejected: { bg: 'bg-red-500/20',    icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,         border: 'border-l-red-500' },
                  visitor_blocked:  { bg: 'bg-red-600/20',    icon: <Ban className="w-3.5 h-3.5 text-red-500" />,             border: 'border-l-red-600' },
                }[n.type] || { bg: 'bg-slate-700', icon: <Bell className="w-3.5 h-3.5 text-slate-400" />, border: 'border-l-slate-600' }

                return (
                  <div
                    key={n.id}
                    className={`p-3 hover:bg-slate-800/40 transition-colors border-l-2 ${typeConfig.border} ${!n.read ? 'bg-indigo-500/5' : ''}`}
                  >
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

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="animate-fade-in space-y-4">
            {/* Security Alerts (Dynamic) */}
            {activeAlerts && activeAlerts.length > 0 && (
              <div className="bg-slate-800/40 border border-red-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="text-sm font-bold text-white">Active Security Alerts</h3>
                </div>
                <div className="space-y-2">
                  {activeAlerts.map(alert => (
                    <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                      alert.type === 'critical' ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        alert.type === 'critical' ? 'bg-red-500 pulse-dot' : 'bg-amber-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">{alert.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{alert.message}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{getTimeAgo(alert.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="stat-card">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center mb-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-2xl font-bold text-white">{pendingVisitors.length}</p>
                <p className="text-xs text-slate-500">Pending Approvals</p>
              </div>
              <div className="stat-card">
                <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center mb-2">
                  <Users className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-2xl font-bold text-white">{todayEntries.length}</p>
                <p className="text-xs text-slate-500">Visitors Today</p>
              </div>
              <div className="stat-card">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center mb-2">
                  <QrCode className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white">{activePasses.length}</p>
                <p className="text-xs text-slate-500">Active Passes</p>
              </div>
              <div className="stat-card">
                <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center mb-2">
                  <Ban className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-2xl font-bold text-white">{visitHistory.filter(v => v.status === 'blocked').length}</p>
                <p className="text-xs text-slate-500">Blocked</p>
              </div>
            </div>

            {/* Pending Approval Card */}
            {pendingVisitors.length > 0 && (
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" /> Pending Approvals
                  </h3>
                  <button onClick={() => setActiveTab('approvals')} className="text-xs text-indigo-400 flex items-center gap-1">
                    View All <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {pendingVisitors.slice(0, 2).map(visitor => (
                  <ResidentApprovalCard key={visitor.id} visitor={visitor}
                    onApprove={() => handleApprove(visitor.id)}
                    onReject={() => handleReject(visitor.id)}
                    onBlock={() => handleBlock(visitor.id, visitor)}
                  />
                ))}
              </div>
            )}

            {/* Quick Actions */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <button onClick={() => setShowPreApprove(true)} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/30 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-xs text-slate-300">Pre-Approve Guest</span>
                </button>
                <button onClick={() => setActiveTab('passes')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/30 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-xs text-slate-300">Manage Passes</span>
                </button>
                <button onClick={() => setActiveTab('security')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/30 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                    <Ban className="w-5 h-5 text-red-400" />
                  </div>
                  <span className="text-xs text-slate-300">Block Visitor</span>
                </button>
                <button onClick={() => setActiveTab('history')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/30 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                    <History className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-xs text-slate-300">View History</span>
                </button>
              </div>
            </div>

            {/* Expected Today */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" /> Expected Visitors Today
                </h3>
                <button onClick={() => setShowExpectedModal(true)} className="text-xs text-indigo-400 flex items-center gap-1 hover:text-indigo-300">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {expectedVisitors.length === 0 ? (
                <div className="text-center py-4 bg-slate-800/30 rounded-xl border border-dashed border-slate-700 mb-2">
                  <p className="text-slate-400 text-xs">No expected visitors for today.</p>
                </div>
              ) : expectedVisitors.map(ev => (
                <div key={ev.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{ev.name}</p>
                      <p className="text-xs text-slate-500">{new Date(ev.expectedDate).toLocaleDateString()} • {ev.timeWindow}</p>
                    </div>
                  </div>
                  <span className="badge badge-info text-[10px]">Expected Today</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-lg font-semibold text-white">Visitor Approval Queue</h2>
            {loadingVisitors ? (
              <p className="text-slate-500 text-sm text-center py-8">Loading...</p>
            ) : pendingVisitors.length > 0 ? (
              pendingVisitors.map(visitor => (
                <ResidentApprovalCard
                  key={visitor.id}
                  visitor={visitor}
                  onApprove={() => handleApprove(visitor.id)}
                  onReject={() => handleReject(visitor.id)}
                  onBlock={() => handleBlock(visitor.id, visitor)}
                  onChat={() => setChatVisitor({ id: visitor.id, name: visitor.name })}
                />
              ))
            ) : (
              <div className="glass-card p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-slate-300">No pending approvals</p>
                <p className="text-xs text-slate-500 mt-1">You're all caught up!</p>
              </div>
            )}

            {visitHistory.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-6">Recently Handled</h3>
                {[...visitHistory]
                  .sort((a, b) => new Date(b.entryTimestamp) - new Date(a.entryTimestamp))
                  .map(visitor => (
                  <div key={visitor.id} className="glass-card p-4 hover:border-slate-600/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {visitor.photo
                          ? <img src={visitor.photo} alt={visitor.name} className="w-full h-full object-cover" />
                          : <span className="text-sm font-bold text-slate-500">{visitor.name?.charAt(0)?.toUpperCase()}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">{visitor.name}</p>
                          <span className={`badge text-[10px] ${
                            visitor.status === 'approved' ? 'badge-info' :
                            visitor.status === 'rejected' ? 'badge-danger' :
                            visitor.status === 'inside' ? 'badge-success' :
                            visitor.status === 'exited' ? 'bg-slate-700 text-slate-300' :
                            visitor.status === 'blocked' ? 'badge-warning' : 'badge-warning'
                          }`}>{visitor.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {visitor.purpose} &bull; {visitor.phone} &bull; {getTimeAgo(visitor.entryTimestamp)}
                        </p>
                        {visitor.guardName && (
                          <p className="text-[10px] text-slate-600 mt-0.5">
                            Guard: <span className="text-slate-400">{visitor.guardName}</span>
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setChatVisitor({ id: visitor.id, name: visitor.name })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors relative flex-shrink-0"
                        title="Message Security"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {visitor.messages?.length > 0 && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-indigo-500 border border-slate-900" />}
                      </button>
                    </div>
                    {visitor.status === 'approved' && visitor.qrToken && (
                      <div className="mt-3 bg-slate-900 border border-indigo-500/30 rounded-lg p-2 text-center flex items-center justify-center gap-2">
                        <QrCode className="w-4 h-4 text-indigo-400" />
                        <span className="text-slate-300 text-xs font-medium">Visitor approved — QR pass generated</span>
                        <span className="text-green-400 text-xs">✓</span>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Visitor History</h2>
              <button onClick={handleExportHistory} className="btn-outline text-xs py-1.5 px-3 border-indigo-500/30 text-indigo-400 hover:border-indigo-500">Export to Excel</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search by name or phone..." 
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="input-field pl-10" 
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['All', 'Approved', 'Rejected', 'Entered', 'Exited'].map(f => (
                <button 
                  key={f} 
                  onClick={() => setHistoryFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    f === historyFilter ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }`}
                >{f}</button>
              ))}
            </div>
            {filteredHistory.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <p className="text-slate-400 text-sm">No visitors found</p>
              </div>
            ) : filteredHistory.map(visitor => (
              <div key={visitor.id} className="glass-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-500 overflow-hidden flex-shrink-0">
                    {visitor.photo
                      ? <img src={visitor.photo} alt={visitor.name} className="w-full h-full object-cover" />
                      : visitor.name?.charAt(0)
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">{visitor.name}</p>
                      <span className={`badge ${
                        visitor.status === 'inside' ? 'badge-success' :
                        visitor.status === 'approved' ? 'badge-info' :
                        visitor.status === 'rejected' ? 'badge-danger' :
                        visitor.status === 'exited' ? 'badge-neutral' : 'badge-warning'
                      }`}>{visitor.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{visitor.purpose}</span>
                      <span>{visitor.phone}</span>
                      <span>{formatDateTime(visitor.entryTimestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PASSES TAB */}
        {activeTab === 'passes' && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Visitor Passes</h2>
              <button onClick={() => setShowPreApprove(true)} className="btn-primary text-xs py-2 px-3">
                <Plus className="w-3.5 h-3.5" /> New Pass
              </button>
            </div>

            {/* Active Pre-Approved Passes */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Active Pre-Approved Passes
              </h3>
              {activePasses.length === 0 ? (
                <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                  <p className="text-slate-400 text-sm">No passes found. Create one with + New Pass.</p>
                </div>
              ) : activePasses.map(pass => {
                const now = new Date()
                const isExpired = pass.validUntil && new Date(pass.validUntil) < now
                const isInside = pass.status === 'inside'
                const isActive = pass.status === 'pre_approved_active' && !isExpired
                return (
                <div key={pass.id} className={`glass-card p-4 mb-3 border ${
                  isInside ? 'border-green-500/30' : isExpired ? 'border-slate-700/30 opacity-60' : 'border-slate-700/50'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isInside ? 'bg-green-500/15' : isExpired ? 'bg-slate-700/30' : 'bg-green-500/15'
                      }`}>
                        <User className={`w-5 h-5 ${isInside ? 'text-green-400' : isExpired ? 'text-slate-500' : 'text-green-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-white">
                            {pass.type === 'event_pass' ? pass.eventName : pass.name}
                            {pass.type === 'event_pass' && <span className="ml-2 bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">Event Pass</span>}
                          </p>
                          <span className={`badge text-[10px] ${
                            isInside ? 'badge-success' : isExpired ? 'bg-slate-700 text-slate-400' : 'badge-info'
                          }`}>
                            {isInside ? 'Inside Now' : isExpired ? 'Expired' : 'Active'}
                          </span>
                        </div>
                        {pass.type === 'event_pass' ? (
                          <p className="text-xs text-slate-500">
                            Usages: <span className="text-white font-medium">{pass.usageCount || 0}</span> / {pass.approxPeopleCount} attendees
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">{pass.phone} &bull; {pass.purpose}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(pass.validFrom).toLocaleDateString('en-IN', {day:'2-digit',month:'short'})}
                          {' → '}
                          {new Date(pass.validUntil).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewQrId(viewQrId === pass.id ? null : pass.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors" title="View QR">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteConfirmId(pass.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors" title="Revoke Pass">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )})}
            </div>

            {/* Expected Visitors */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Expected Visitors Today
              </h3>
              {expectedVisitors.length === 0 ? (
                <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-700 mb-2">
                  <p className="text-slate-400 text-sm">No expected visitors found.</p>
                </div>
              ) : expectedVisitors.map(ev => (
                <div key={ev.id} className="glass-card p-4 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{ev.name}</p>
                        <p className="text-xs text-slate-500">{ev.purpose}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{ev.phone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="badge badge-info text-[10px] mb-1">Expected Today</span>
                      <p className="text-xs text-slate-400">{ev.timeWindow}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-lg font-semibold text-white">Security — Blocked Visitors</h2>
            <p className="text-xs text-slate-500">Visitors you have blocked from entering your flat. You can unblock or permanently remove them.</p>

            {loadingBlocked ? (
              <div className="text-center py-10 text-slate-500 text-sm">Loading...</div>
            ) : blockedVisitors.length === 0 ? (
              <div className="glass-card p-8 text-center border border-dashed border-slate-700">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Ban className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm font-medium">No blocked visitors</p>
                <p className="text-xs text-slate-600 mt-1">Visitors you block from the approval queue will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {blockedVisitors.map(v => (
                  <div key={v.id} className="glass-card p-4 border border-red-500/15">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {v.photo
                          ? <img src={v.photo} alt={v.name} className="w-full h-full object-cover" />
                          : <span className="text-sm font-bold text-red-400">{v.name?.charAt(0)?.toUpperCase()}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">{v.name}</p>
                          <span className="badge badge-danger text-[10px]">Blocked</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{v.phone}</p>
                        <p className="text-xs text-slate-500">{v.purpose} &bull; Flat {v.flatGate}</p>
                        {v.blockedAt && (
                          <p className="text-[10px] text-slate-600 mt-0.5">
                            Blocked {getTimeAgo(v.blockedAt)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={async () => {
                            await unblockVisitor(v.id)
                            setBlockedVisitors(prev => prev.filter(b => b.id !== v.id))
                          }}
                          className="px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 text-[10px] font-semibold hover:bg-green-500/20 transition-colors whitespace-nowrap"
                        >
                          Unblock
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove ${v.name} from blocked list permanently?`)) return
                            await removeVisitorEntry(v.id)
                            setBlockedVisitors(prev => prev.filter(b => b.id !== v.id))
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-semibold hover:border-red-500/40 hover:text-red-400 transition-colors whitespace-nowrap"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-lg font-semibold text-white">Settings</h2>

            {profileError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg mb-4">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="bg-green-500/10 border border-green-500/50 text-green-500 text-sm p-3 rounded-lg mb-4">
                {profileSuccess}
              </div>
            )}

            <form onSubmit={handleProfileUpdate} className="glass-card p-5 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Full Name</label>
                <input type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Email</label>
                <input type="email" value={user.email} className="input-field opacity-50 cursor-not-allowed" disabled />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Phone (must start with +91)</label>
                <input type="tel" value={profileData.phoneNumber} onChange={e => setProfileData({...profileData, phoneNumber: e.target.value})} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Flat Number</label>
                <input type="text" value={user.flatGate || user.flat} className="input-field opacity-50 cursor-not-allowed" disabled />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">WhatsApp Number (for approval notifications)</label>
                <input type="tel" defaultValue={user.phone} className="input-field" />
                <p className="text-[10px] text-slate-500 mt-1">Receive visitor approval requests via WhatsApp</p>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3">Notification Preferences</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Push notifications for new visitors', checked: true },
                    { label: 'WhatsApp approval messages', checked: true },
                    { label: 'Security alerts', checked: true },
                    { label: 'Delivery notifications', checked: false },
                  ].map((pref, i) => (
                    <label key={i} className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-slate-300">{pref.label}</span>
                      <div className={`w-10 h-6 rounded-full transition-colors relative ${pref.checked ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                        <div className={`absolute w-4 h-4 rounded-full bg-white top-1 transition-transform ${pref.checked ? 'left-5' : 'left-1'}`} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button disabled={profileLoading} type="submit" className="btn-primary w-full justify-center">
                {profileLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Pre-Approve Visitor Modal */}
      {showPreApprove && (
        <PreApproveVisitorModal 
           onClose={() => setShowPreApprove(false)} 
           user={user} 
        />
      )}

      {showExpectedModal && (
        <ExpectedVisitorModal onClose={() => setShowExpectedModal(false)} user={user} />
      )}

      {chatVisitor && (
        <VisitorChatModal
          visitorId={chatVisitor.id}
          visitorName={chatVisitor.name}
          user={user}
          onClose={() => setChatVisitor(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-xs p-6 animate-fade-in text-center shadow-xl border border-red-500/20">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Delete Pass?</h3>
            <p className="text-sm text-slate-400 mb-6">Are you sure you want to completely delete this pass? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="btn-outline flex-1 justify-center py-2 text-sm">
                Cancel
              </button>
              <button onClick={() => handleDeletePass(deleteConfirmId)} className="btn-danger flex-1 justify-center py-2 text-sm shadow-lg shadow-red-500/20">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View QR Modal */}
      {viewQrId && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm p-6 animate-fade-in text-center shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Visitor Pass QR</h3>
              <button onClick={() => setViewQrId(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-6 inline-block mx-auto mb-4 border border-slate-700">
              <div className="bg-white rounded-xl p-2 inline-block">
                <QRCodeCanvas id="view-qr-canvas" value={viewQrId} size={180} level="H" includeMargin />
              </div>
            </div>
            
            <p className="text-sm text-slate-300 mb-6 px-4">
              Hold this code up to the guard's scanner for direct entry. 
            </p>
            
            <div className="flex gap-3">
              <button onClick={() => downloadViewedQR(activePasses.find(p => p.id === viewQrId)?.name || 'Guest')} className="btn-primary flex-1 justify-center py-2.5">
                Download Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Overlay */}
      {showChat && <ChatOverlay onClose={() => setShowChat(null)} />}
    </div>
  )
}

function ApprovalCard({ visitor, expanded, onChat, onShowQR }) {
  return (
    <div className="glass-card-hover p-4 mb-3 border-amber-500/10 animate-fade-in">
      <div className="flex items-start gap-3">
        {/* Visitor Photo placeholder */}
        <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl font-bold text-slate-500 flex-shrink-0">
          {visitor.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{visitor.name}</p>
            <span className={`badge ${getRiskBadge(visitor.riskLevel)}`}>
              {visitor.riskLevel === 'High' && <AlertTriangle className="w-3 h-3" />}
              {visitor.riskLevel} Risk
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{visitor.phone}</span>
            <span>{visitor.purpose}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            <Clock className="w-3 h-3 inline" /> {getTimeAgo(visitor.timestamp)} • Gate: {visitor.gate}
          </p>

          {/* Trust score */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-slate-500">Trust</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800 max-w-32">
              <div className="h-full rounded-full" style={{ width: `${visitor.trustScore}%`, backgroundColor: getTrustColor(visitor.trustScore) }} />
            </div>
            <span className="text-xs font-medium" style={{ color: getTrustColor(visitor.trustScore) }}>{visitor.trustScore}</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            <button className="btn-success text-xs py-2 px-4">
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
            <button className="btn-danger text-xs py-2 px-4">
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
            <button onClick={onChat} className="btn-outline text-xs py-2 px-3">
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatOverlay({ onClose }) {
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
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Chat with Guard</h3>
            <p className="text-xs text-slate-500">Re: Visitor at Main Gate</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === 'resident' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.sender === 'resident' ? 'bg-indigo-500/20 text-indigo-100 rounded-br-md' : 'bg-slate-800 text-slate-200 rounded-bl-md'
              }`}>
                <p className="text-sm">{msg.text}</p>
                <p className="text-[10px] text-slate-500 mt-1">{msg.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-800">
          <div className="flex gap-2">
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..." className="input-field flex-1" />
            <button className="btn-primary px-3"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── EXPECTED VISITOR MODAL ─── */
function ExpectedVisitorModal({ onClose, user }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    purpose: '',
    timeWindow: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (!validatePhoneFormat(formData.phone)) {
        throw new Error('Phone number must be +91 followed by 10 digits.')
      }

      await createExpectedVisitor({
        name: formData.name,
        phone: formData.phone,
        purpose: formData.purpose,
        timeWindow: formData.timeWindow,
        flatGate: user.flatGate || user.flat,
        societyName: user.societyName,
        residentUid: user.uid
      })
      
      onClose()
    } catch(err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">Add Expected Visitor</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Visitor Name *</label>
            <input type="text" placeholder="Full name" className="input-field" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Phone Number *</label>
            <input type="tel" placeholder="+91 9876543210" className="input-field" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Purpose of Visit *</label>
            <input type="text" placeholder="e.g. Guest, Delivery, Repair..." className="input-field" required value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Expected Time Window *</label>
            <input type="text" placeholder="e.g. 14:00 - 15:00" className="input-field" required value={formData.timeWindow} onChange={e => setFormData({...formData, timeWindow: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Flat Number (Auto)</label>
            <input type="text" value={user.flatGate || user.flat} className="input-field opacity-50 cursor-not-allowed" disabled />
          </div>

          <button disabled={loading} type="submit" className="btn-primary w-full justify-center mt-6">
            {loading ? 'Saving...' : 'Save Expected Visitor'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ─── PRE-APPROVE VISITOR MODAL ─── */
function PreApproveVisitorModal({ onClose, user }) {
  const [mode, setMode] = useState('guest') // 'guest' | 'event'
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    purpose: '',
    eventName: '',
    approxPeopleCount: '',
    validFrom: '',
    validUntil: '',
    photo: null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passId, setPassId] = useState(null)

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) return alert('Max image size is 5MB.')
      try {
        const base64 = await compressImageToBase64(file, 400)
        setFormData(prev => ({ ...prev, photo: base64 }))
      } catch (err) {
        alert('Could not compress photo.')
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (new Date(formData.validFrom) >= new Date(formData.validUntil)) {
        throw new Error('Valid Until must be after Valid From time.')
      }

      let passData = {}
      if (mode === 'guest') {
        if (!validatePhoneFormat(formData.phone)) {
          throw new Error('Phone number must be +91 followed by 10 digits.')
        }
        passData = {
          name: formData.name,
          phone: formData.phone,
          purpose: formData.purpose,
          flatGate: user.flatGate || user.flat,
          societyName: user.societyName,
          residentUid: user.uid,
          validFrom: new Date(formData.validFrom).toISOString(),
          validUntil: new Date(formData.validUntil).toISOString(),
          type: 'pre_approved_visitor',
          photo: formData.photo
        }
      } else {
        if (!formData.eventName || !formData.approxPeopleCount) {
          throw new Error('Please fill all event details.')
        }
        passData = {
          eventName: formData.eventName,
          approxPeopleCount: Number(formData.approxPeopleCount),
          usageCount: 0,
          flatGate: user.flatGate || user.flat,
          societyName: user.societyName,
          residentUid: user.uid,
          validFrom: new Date(formData.validFrom).toISOString(),
          validUntil: new Date(formData.validUntil).toISOString(),
          type: 'event_pass'
        }
      }

      const id = await createPreApprovedPass(passData)
      setPassId(id)
    } catch(err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadQR = () => {
    const canvas = document.getElementById('pass-qr-canvas')
    if (canvas) {
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = `visitor-pass-${formData.name}.png`
      link.click()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">Pre-Approve Visitor</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        {passId ? (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-green-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white">Pass Generated Successfully!</h4>
            <p className="text-sm text-slate-400">Scan this QR Code at the gate for instant entry.</p>
            
            <div className="bg-slate-800/50 rounded-xl p-6 inline-block mx-auto">
              <div className="bg-white rounded-xl p-2 inline-block">
                <QRCodeCanvas id="pass-qr-canvas" value={passId} size={150} level="H" includeMargin />
              </div>
            </div>
            
            <div className="text-left text-xs text-slate-500 bg-slate-800/30 p-3 rounded-lg space-y-1">
              {mode === 'guest' ? (
                <>
                  <p><span className="text-slate-400 font-medium">Visitor:</span> {formData.name}</p>
                  <p><span className="text-slate-400 font-medium">Phone:</span> {formData.phone}</p>
                </>
              ) : (
                <>
                  <p><span className="text-slate-400 font-medium">Event:</span> {formData.eventName}</p>
                  <p><span className="text-slate-400 font-medium">Max People:</span> {formData.approxPeopleCount}</p>
                </>
              )}
              <p><span className="text-slate-400 font-medium">Valid:</span> {new Date(formData.validFrom).toLocaleString()} to {new Date(formData.validUntil).toLocaleString()}</p>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={downloadQR} className="btn-primary flex-1 justify-center">
                Download Pass
              </button>
              <button onClick={onClose} className="btn-outline flex-1 justify-center">
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2 p-1 bg-slate-800 rounded-xl mb-4">
              <button type="button" onClick={() => setMode('guest')} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${mode === 'guest' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>Guest Pass</button>
              <button type="button" onClick={() => setMode('event')} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${mode === 'event' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'}`}>Event Pass</button>
            </div>
            
            {mode === 'guest' ? (
              <>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Visitor Name *</label>
                  <input type="text" placeholder="Full name" className="input-field" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Phone Number *</label>
                  <input type="tel" placeholder="+91 9876543210" className="input-field" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Purpose of Visit *</label>
                  <input type="text" placeholder="e.g. Guest, Delivery, Repair..." className="input-field" required value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Event Name *</label>
                  <input type="text" placeholder="e.g. Birthday Party" className="input-field" required value={formData.eventName} onChange={e => setFormData({...formData, eventName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Approx People Count *</label>
                  <input type="number" min="1" placeholder="e.g. 30" className="input-field" required value={formData.approxPeopleCount} onChange={e => setFormData({...formData, approxPeopleCount: e.target.value})} />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Flat Number</label>
              <input type="text" value={user.flatGate || user.flat} className="input-field opacity-50 cursor-not-allowed" disabled />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Valid From *</label>
                <input type="datetime-local" className="input-field text-sm px-2" required value={formData.validFrom} onChange={e => setFormData({...formData, validFrom: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Valid Until *</label>
                <input type="datetime-local" className="input-field text-sm px-2" required value={formData.validUntil} onChange={e => setFormData({...formData, validUntil: e.target.value})} />
              </div>
            </div>

            {mode === 'guest' && (
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Visitor Photo (Optional)</label>
                <div className="relative border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:bg-slate-800/50 transition-colors">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handlePhotoCapture} 
                  />
                  {formData.photo ? (
                    <div className="flex items-center justify-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Photo Captured</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <Camera className="w-5 h-5" />
                      <span className="text-sm">Tap to take a photo or upload</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              <button type="button" disabled={loading} onClick={onClose} className="btn-outline flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={loading} className="btn-success flex-1 justify-center">
                {loading ? 'Generating...' : 'Generate Pass'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/* ─── RESIDENT APPROVAL CARD ─── */
function ResidentApprovalCard({ visitor, onApprove, onReject, onBlock, onChat }) {
  const [busy, setBusy] = useState(false)

  const act = async (fn) => {
    setBusy(true)
    try { await fn() } catch(e) { console.error(e) }
    setBusy(false)
  }

  return (
    <div className="glass-card p-4 border border-amber-500/20 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-bold text-slate-500 flex-shrink-0 overflow-hidden">
          {visitor.photo
            ? <img src={visitor.photo} alt={visitor.name} className="w-full h-full object-cover" />
            : visitor.name?.charAt(0)
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{visitor.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{visitor.phone}</p>
            </div>
            {visitor.faceMatch === 'mismatch' && (
              <span className="badge badge-danger text-[10px] flex items-center gap-1 flex-shrink-0">⚠ Face Mismatch</span>
            )}
            {visitor.faceMatch === 'matched' && (
              <span className="badge badge-success text-[10px] flex-shrink-0">✓ Face OK</span>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-1 text-xs text-slate-400">
            <p><span className="text-slate-500">Purpose:</span> {visitor.purpose}</p>
            <p><span className="text-slate-500">Flat:</span> {visitor.flatGate}</p>
            <p><span className="text-slate-500">Time:</span> {new Date(visitor.entryTimestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <button onClick={() => onChat()}
              className="flex-1 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/20 transition-colors flex items-center justify-center gap-1 min-w-[70px] relative">
              <MessageCircle className="w-4 h-4" />
              Chat
              {visitor.messages?.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400" />}
            </button>
            <button disabled={busy} onClick={() => act(onApprove)}
              className="flex-1 py-2 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-colors">
              ✓ Approve
            </button>
            <button disabled={busy} onClick={() => act(onReject)}
              className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors">
              ✗ Reject
            </button>
            <button disabled={busy} onClick={() => act(onBlock)}
              className="flex-1 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold hover:bg-orange-500/25 transition-colors">
              Block
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
