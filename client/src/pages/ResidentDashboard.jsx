import { useState, useContext, useEffect } from 'react'
import { AuthContext } from '../App'
import {
  Shield, LogOut, Bell, Home, Clock, Users, History, Settings,
  CheckCircle, XCircle, AlertTriangle, QrCode, Plus, Search,
  Phone, User, Calendar, ChevronRight, Eye, MessageCircle,
  Ban, List, UserPlus, Trash2, Edit, Pause, Play, X, Send,
  Truck, MapPin, Share2
} from 'lucide-react'
import {
  mockVisitors, mockNotifications, mockRecurringPasses, mockExpectedVisitors,
  mockBlocklist, mockWatchlist, formatTime, formatDate, formatDateTime,
  getTimeAgo, getStatusColor, getStatusLabel, getRiskBadge, getTrustColor
} from '../data/mockData'
import { QRCodeCanvas } from 'qrcode.react'
import { db } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { validatePhoneFormat, checkPhoneUnique } from '../utils/phoneValidation'
import {
  getPendingVisitorsForFlat, getVisitorHistoryForFlat,
  approveVisitor, rejectVisitor, blockVisitor, getTodayEntries,
  createPreApprovedPass, compressImageToBase64
} from '../utils/visitorHelpers'

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
  const unreadCount = mockNotifications.filter(n => !n.read).length

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

  // Load real visitor data
  useEffect(() => {
    if (!user?.societyName || !user?.flatGate) return
    const load = async () => {
      try {
        const safeFlat = user.flatGate.trim().toUpperCase()
        const [pending, history, today] = await Promise.all([
          getPendingVisitorsForFlat(user.societyName, safeFlat),
          getVisitorHistoryForFlat(user.societyName, safeFlat),
          getTodayEntries(user.societyName)
        ])
        setPendingVisitors(pending)
        setVisitHistory(history)
        setTodayEntries(today.filter(v => v.flatGate === safeFlat || v.flatGate === user.flatGate))
      } catch(e) { console.error(e) } finally { setLoadingVisitors(false) }
    }
    load()
  }, [user])

  const handleApprove = async (visitorId) => {
    await approveVisitor(visitorId)
    setPendingVisitors(prev => prev.filter(v => v.id !== visitorId))
    const updated = await getVisitorHistoryForFlat(user.societyName, user.flatGate.trim().toUpperCase())
    setVisitHistory(updated)
  }

  const handleReject = async (visitorId) => {
    await rejectVisitor(visitorId)
    setPendingVisitors(prev => prev.filter(v => v.id !== visitorId))
  }

  const handleBlock = async (visitorId, visitorData) => {
    await blockVisitor(visitorId, visitorData)
    setPendingVisitors(prev => prev.filter(v => v.id !== visitorId))
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
              <p className="text-[10px] text-slate-500">Flat {user.flat} • Resident</p>
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
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">
                {user?.name?.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() || 'U'}
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
          <div className="absolute top-[60px] right-4 w-80 glass-card p-0 overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              <button className="text-xs text-indigo-400 hover:text-indigo-300">Mark all read</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {mockNotifications.map(n => (
                <div key={n.id} className={`p-3 border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors ${!n.read ? 'bg-indigo-500/5' : ''}`}>
                  <div className="flex gap-3">
                    {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />}
                    <div className={!n.read ? '' : 'pl-5'}>
                      <p className="text-sm text-white font-medium">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-slate-600 mt-1">{getTimeAgo(n.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="animate-fade-in space-y-4">
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
                <p className="text-2xl font-bold text-white">{mockRecurringPasses.filter(p => p.active).length}</p>
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
                <button className="text-xs text-indigo-400 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {mockExpectedVisitors.map(ev => (
                <div key={ev.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{ev.name}</p>
                      <p className="text-xs text-slate-500">{ev.expectedDate} • {ev.timeWindow}</p>
                    </div>
                  </div>
                  <span className="badge badge-info text-[10px]">Expected</span>
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
                />
              ))
            ) : (
              <div className="glass-card p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-slate-300">No pending approvals</p>
                <p className="text-xs text-slate-500 mt-1">You're all caught up!</p>
              </div>
            )}

            {visitHistory.filter(v => ['approved', 'rejected', 'blocked'].includes(v.status)).length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-6">Recently Handled</h3>
                {visitHistory.filter(v => ['approved', 'rejected', 'blocked'].includes(v.status)).slice(0, 5).map(visitor => (
                  <div key={visitor.id} className="glass-card p-4 opacity-80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {visitor.photo
                          ? <img src={visitor.photo} alt={visitor.name} className="w-full h-full object-cover" />
                          : <span className="text-sm font-bold text-slate-500">{visitor.name?.charAt(0)}</span>
                        }
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white">{visitor.name}</p>
                        <p className="text-xs text-slate-500">{visitor.purpose} • {visitor.phone} • {getTimeAgo(visitor.entryTimestamp)}</p>
                      </div>
                      <span className={`badge ${
                        visitor.status === 'approved' ? 'badge-info' :
                        visitor.status === 'rejected' ? 'badge-danger' : 'badge-warning'
                      }`}>{visitor.status}</span>
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

            {/* Recurring Passes */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Recurring Passes
              </h3>
              {mockRecurringPasses.map(pass => (
                <div key={pass.id} className={`glass-card p-4 mb-3 ${!pass.active ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{pass.name}</p>
                        <p className="text-xs text-slate-500">{pass.phone}</p>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {pass.days.map(day => (
                            <span key={day} className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">{day}</span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{pass.timeWindow}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 transition-colors">
                        {pass.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`badge ${pass.active ? 'badge-success' : 'badge-neutral'}`}>
                      {pass.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Expected Visitors */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Expected Visitors
              </h3>
              {mockExpectedVisitors.map(ev => (
                <div key={ev.id} className="glass-card p-4 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                        <User className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{ev.name}</p>
                        <p className="text-xs text-slate-500">{ev.phone}</p>
                        <p className="text-xs text-slate-500">{ev.expectedDate} • {ev.timeWindow}</p>
                      </div>
                    </div>
                    <button className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-lg font-semibold text-white">Security Settings</h2>

            {/* Blocklist */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                  <Ban className="w-4 h-4" /> Blocked Visitors
                </h3>
                <button className="btn-danger text-xs py-1.5 px-3">
                  <Plus className="w-3 h-3" /> Block Number
                </button>
              </div>
              {mockBlocklist.map(bl => (
                <div key={bl.id} className="glass-card p-4 mb-3 border-red-500/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{bl.name}</p>
                        {bl.societyWide && (
                          <span className="badge badge-warning text-[10px]">
                            <Share2 className="w-3 h-3" /> Society-wide
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{bl.phone}</p>
                      <p className="text-xs text-slate-500 mt-1">Reason: {bl.reason}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Blocked on {bl.addedOn}</p>
                    </div>
                    <button className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Watchlist */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Watchlist
                </h3>
                <button className="btn-outline text-xs py-1.5 px-3 border-amber-500/30 text-amber-400 hover:border-amber-500">
                  <Plus className="w-3 h-3" /> Add to Watchlist
                </button>
              </div>
              {mockWatchlist.map(wl => (
                <div key={wl.id} className="glass-card p-4 mb-3 border-amber-500/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{wl.name}</p>
                      <p className="text-xs text-slate-500">{wl.phone}</p>
                      <p className="text-xs text-slate-500 mt-1">Reason: {wl.reason}</p>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn-danger text-[10px] py-1 px-2">Block</button>
                      <button className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

/* ─── PRE-APPROVE VISITOR MODAL ─── */
function PreApproveVisitorModal({ onClose, user }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    purpose: '',
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
      if (!validatePhoneFormat(formData.phone)) {
        throw new Error('Phone number must be +91 followed by 10 digits.')
      }
      if (new Date(formData.validFrom) >= new Date(formData.validUntil)) {
        throw new Error('Valid Until must be after Valid From time.')
      }

      const passData = {
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
              <p><span className="text-slate-400 font-medium">Visitor:</span> {formData.name}</p>
              <p><span className="text-slate-400 font-medium">Phone:</span> {formData.phone}</p>
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
function ResidentApprovalCard({ visitor, onApprove, onReject, onBlock }) {
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
          <div className="flex gap-2 mt-3">
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
