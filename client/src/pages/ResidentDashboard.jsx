import { useState, useContext } from 'react'
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
import { QRCodeSVG } from 'qrcode.react'

export default function ResidentDashboard() {
  const { user, logout } = useContext(AuthContext)
  const [activeTab, setActiveTab] = useState('home')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPreApprove, setShowPreApprove] = useState(false)
  const [showChat, setShowChat] = useState(null)
  const [showQR, setShowQR] = useState(null)
  const unreadCount = mockNotifications.filter(n => !n.read).length

  const myVisitors = mockVisitors.filter(v => v.flat === 'A-302')
  const pendingVisitors = mockVisitors.filter(v => v.status === 'pending' && v.flat === 'A-302')

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle, badge: pendingVisitors.length },
    { id: 'history', label: 'History', icon: History },
    { id: 'passes', label: 'Passes', icon: QrCode },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

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
                {user.avatar}
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
                <p className="text-2xl font-bold text-white">12</p>
                <p className="text-xs text-slate-500">This Month</p>
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
                <p className="text-2xl font-bold text-white">{mockBlocklist.length}</p>
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
                {pendingVisitors.map(visitor => (
                  <ApprovalCard key={visitor.id} visitor={visitor} onChat={() => setShowChat(visitor.id)} />
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

        {/* APPROVALS TAB */}
        {activeTab === 'approvals' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-lg font-semibold text-white">Visitor Approval Queue</h2>
            {pendingVisitors.length > 0 ? (
              pendingVisitors.map(visitor => (
                <ApprovalCard key={visitor.id} visitor={visitor} expanded onChat={() => setShowChat(visitor.id)} onShowQR={() => setShowQR(visitor.id)} />
              ))
            ) : (
              <div className="glass-card p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-slate-300">No pending approvals</p>
                <p className="text-xs text-slate-500 mt-1">You're all caught up!</p>
              </div>
            )}

            {/* Recently handled */}
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-6">Recently Handled</h3>
            {mockVisitors.filter(v => ['approved', 'rejected'].includes(v.status) && v.flat === 'A-302').map(visitor => (
              <div key={visitor.id} className="glass-card p-4 opacity-75">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-500">
                    {visitor.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">{visitor.name}</p>
                    <p className="text-xs text-slate-500">{visitor.purpose} • {getTimeAgo(visitor.timestamp)}</p>
                  </div>
                  <span className={`badge ${getStatusColor(visitor.status)}`}>{getStatusLabel(visitor.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Visitor History</h2>
              <button className="btn-outline text-xs py-1.5 px-3">Export</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Search by name or phone..." className="input-field pl-10" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['All', 'Approved', 'Rejected', 'Entered', 'Exited'].map(f => (
                <button key={f} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  f === 'All' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800/60 text-slate-400 border border-slate-700'
                }`}>{f}</button>
              ))}
            </div>
            {myVisitors.map(visitor => (
              <div key={visitor.id} className="glass-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-500">
                    {visitor.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">{visitor.name}</p>
                      <span className={`badge ${getStatusColor(visitor.status)}`}>{getStatusLabel(visitor.status)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{visitor.purpose}</span>
                      <span>{formatDateTime(visitor.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`badge ${getRiskBadge(visitor.riskLevel)}`}>{visitor.riskLevel}</span>
                      <span className="text-xs text-slate-500">Trust: {visitor.trustScore}/100</span>
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

            <div className="glass-card p-5 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Full Name</label>
                <input type="text" defaultValue={user.name} className="input-field" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Email</label>
                <input type="email" defaultValue={user.email} className="input-field" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Phone</label>
                <input type="tel" defaultValue={user.phone} className="input-field" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Flat Number</label>
                <input type="text" defaultValue={user.flat} className="input-field" disabled />
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

              <button className="btn-primary w-full justify-center">Save Settings</button>
            </div>
          </div>
        )}
      </main>

      {/* Pre-Approve Modal */}
      {showPreApprove && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">Pre-Approve Guest</h3>
              <button onClick={() => setShowPreApprove(false)} className="p-2 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Guest Name</label>
                <input type="text" placeholder="Full name" className="input-field" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Phone Number</label>
                <input type="tel" placeholder="+91 98765 43210" className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Valid From</label>
                  <input type="datetime-local" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Valid Until</label>
                  <input type="datetime-local" className="input-field" />
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400 mb-3">QR Code will be generated here</p>
                <div className="w-32 h-32 mx-auto bg-white rounded-xl p-2 flex items-center justify-center">
                  <QRCodeSVG value="securegate://preapproval/demo-token" size={110} />
                </div>
                <p className="text-xs text-slate-500 mt-2">Share this QR with your guest</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPreApprove(false)} className="btn-outline flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-success flex-1 justify-center">Generate Pass</button>
              </div>
            </form>
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
