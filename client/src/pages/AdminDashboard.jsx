import React, { useState, useContext, useEffect, useRef, useMemo } from 'react'
import { AuthContext } from '../App'
import { db } from '../firebase'
import { secondaryAuth } from '../firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore'
import {
  Shield, LogOut, Bell, LayoutDashboard, Users, AlertTriangle,
  BarChart3, UserCog, Settings, Search, Download, CheckCircle,
  XCircle, Clock, TrendingUp, Eye, Ban, MapPin, FileText,
  ChevronRight, Filter, RefreshCw, ChevronDown, X, Activity,
  Truck, AlertCircle, Zap, ArrowUpRight, ArrowDownRight, UserPlus,
  Trash2, Edit, UploadCloud
} from 'lucide-react'
import {
  mockVisitors, mockAnalytics,
  formatDateTime, getTimeAgo, getStatusColor, getStatusLabel,
  getRiskBadge, getTrustColor
} from '../data/mockData'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { validatePhoneFormat, checkPhoneUnique } from '../utils/phoneValidation'
import { getAllVisitorsForSociety, getAllGuardsForSociety } from '../utils/visitorHelpers'

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext)
  const [activeSection, setActiveSection] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [societyVisitors, setSocietyVisitors] = useState([])
  const [societyGuards, setSocietyGuards] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  // Real-time alerts based on visitor telemetry
  const activeAlerts = useMemo(() => {
    if (!societyVisitors || societyVisitors.length === 0) return []
    const alertsMap = new Map() // prevent duplicates

    societyVisitors.forEach(v => {
      // 1. Face Mismatch
      if (v.faceMatch === 'mismatch' || v.faceMatch === 'failed') {
        const id = `mismatch-${v.id}`
        alertsMap.set(id, {
          id,
          type: 'critical',
          title: 'Face Mismatch Detected',
          message: `Visitor "${v.name}" had a face mismatch matching mobile ${v.phone} to Flat ${v.flatGate}.`,
          timestamp: v.entryTimestamp || new Date().toISOString(),
          resolved: false
        })
      }

      // 2. Late Night Entry
      if (v.entryTimestamp) {
        const date = new Date(v.entryTimestamp)
        const istHours = (date.getUTCHours() + 5.5) % 24
        if (istHours >= 0 && istHours < 5) {
          const id = `latenight-${v.id}`
          alertsMap.set(id, {
            id,
            type: 'warning',
            title: 'Late Night Entry',
            message: `Visitor "${v.name}" entered at ${date.toLocaleTimeString()} to Flat ${v.flatGate}.`,
            timestamp: v.entryTimestamp,
            resolved: false
          })
        }
      }
    })

    // 3. Multi-Activity (same phone > 1 distinct flat in recent history)
    const phoneToFlats = {}
    societyVisitors.forEach(v => {
      if (!v.phone || !v.flatGate) return
      if (!phoneToFlats[v.phone]) phoneToFlats[v.phone] = { flats: new Set(), lastVisit: v }
      phoneToFlats[v.phone].flats.add(v.flatGate)
      if (new Date(v.entryTimestamp) > new Date(phoneToFlats[v.phone].lastVisit.entryTimestamp)) {
        phoneToFlats[v.phone].lastVisit = v
      }
    })

    Object.entries(phoneToFlats).forEach(([phone, data]) => {
      if (data.flats.size > 1) {
        const id = `multi-${phone.replace(/\D/g, '')}`
        alertsMap.set(id, {
          id,
          type: 'critical',
          title: 'Suspicious Multi-Flat Activity',
          message: `Phone ${phone} (${data.lastVisit.name || 'Unknown'}) visited ${data.flats.size} different flats.`,
          timestamp: data.lastVisit.entryTimestamp || new Date().toISOString(),
          resolved: false
        })
      }
    })

    // 4. Repeated Rejections (same phone rejected >= 2 times)
    const phoneRejections = {}
    societyVisitors.forEach(v => {
      if (v.status === 'rejected' && v.phone) {
        if (!phoneRejections[v.phone]) phoneRejections[v.phone] = []
        phoneRejections[v.phone].push(v)
      }
    })

    Object.entries(phoneRejections).forEach(([phone, rejections]) => {
      if (rejections.length >= 2) {
        // Sort to get the latest rejection for timestamp
        rejections.sort((a, b) => new Date(b.entryTimestamp) - new Date(a.entryTimestamp))
        const lastRejection = rejections[0]
        const id = `rej-${phone.replace(/\D/g, '')}`
        alertsMap.set(id, {
          id,
          type: 'warning',
          title: 'Repeated Visitor Rejections',
          message: `Phone ${phone} (${lastRejection.name || 'Unknown'}) was rejected ${rejections.length} times recently.`,
          timestamp: lastRejection.entryTimestamp || new Date().toISOString(),
          resolved: false
        })
      }
    })

    return Array.from(alertsMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [societyVisitors])

  useEffect(() => {
    if (!user?.societyName) return
    const fetchData = async () => {
      try {
        const [visitors, guards] = await Promise.all([
          getAllVisitorsForSociety(user.societyName),
          getAllGuardsForSociety(user.societyName)
        ])
        setSocietyVisitors(visitors)
        setSocietyGuards(guards)
      } catch (err) {
        console.error("Failed to load dashboard data:", err)
      } finally {
        setDataLoading(false)
      }
    }
    fetchData()
  }, [user])

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'verify', label: 'Verify Residents', icon: CheckCircle },
    { id: 'visitors', label: 'Visitors', icon: Users },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: activeAlerts.filter(a => !a.resolved).length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'heatmap', label: 'Heatmap', icon: Activity },
    { id: 'guards', label: 'Guards', icon: UserCog },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-dark)] flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 glass-card rounded-none border-t-0 border-l-0 border-b-0 flex flex-col`}>
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="text-sm font-bold text-white">SecureGate</h1>
              <p className="text-[10px] text-slate-500">Admin Dashboard</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all ${
                  sidebarOpen ? 'px-3 py-2.5' : 'justify-center py-3'
                } ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="flex-1 text-left">{item.label}</span>}
                {sidebarOpen && item.badge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                {!sidebarOpen && item.badge > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-800">
          <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'gap-2 flex-col justify-center'}`}>
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0" title={user?.name}>
              {user?.name?.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500">Admin</p>
              </div>
            )}
            <button onClick={logout} className="p-2 rounded-lg text-slate-500 hover:text-red-400 transition-colors flex-shrink-0" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarOpen ? 'lg:ml-0' : ''} min-h-screen`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-40 glass-card rounded-none border-x-0 border-t-0 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors">
                <LayoutDashboard className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-white capitalize">{activeSection}</h2>
                <p className="text-xs text-slate-500">Green Valley Society • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" placeholder="Search..." className="input-field pl-10 w-64 py-2" />
              </div>
              <button onClick={() => setActiveSection('alerts')} className="relative p-2 rounded-xl bg-slate-800/60 text-slate-400 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
                {activeAlerts.filter(a => !a.resolved).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center">
                    {activeAlerts.filter(a => !a.resolved).length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* OVERVIEW */}
          {activeSection === 'overview' && <OverviewSection user={user} onNavigate={setActiveSection} societyVisitors={societyVisitors} activeAlerts={activeAlerts} />}

          {/* VERIFY RESIDENTS */}
          {activeSection === 'verify' && <VerifyResidentsSection />}

          {/* VISITORS */}
          {activeSection === 'visitors' && <VisitorsSection societyVisitors={societyVisitors} societyGuards={societyGuards} />}

          {/* ALERTS */}
          {activeSection === 'alerts' && <AlertsSection activeAlerts={activeAlerts} />}

          {/* ANALYTICS */}
          {activeSection === 'analytics' && <AnalyticsSection societyVisitors={societyVisitors} />}

          {/* HEATMAP */}
          {activeSection === 'heatmap' && <HeatmapSection societyVisitors={societyVisitors} />}

          {/* GUARDS */}
          {activeSection === 'guards' && <GuardsSection societyVisitors={societyVisitors} societyGuards={societyGuards} />}

          {/* SETTINGS */}
          {activeSection === 'settings' && <SettingsSection />}
        </div>
      </main>
    </div>
  )
}

function OverviewSection({ user, onNavigate, societyVisitors, activeAlerts }) {
  const [realStats, setRealStats] = useState({
    todayVisitors: 0,
    currentlyInside: 0,
    approvalRate: 0,
    weekVisitors: 0
  })
  const [weeklyTrend, setWeeklyTrend] = useState([])

  useEffect(() => {
    if (!societyVisitors) return

    // Calculate 'todayString' in IST
    const now = new Date()
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
    const todayString = ist.toISOString().slice(0, 10)
    
    const todayVisitors = societyVisitors.filter(v => v.date === todayString)
    const insideCount = todayVisitors.filter(v => v.status === 'inside').length
    
    const resolvedToday = todayVisitors.filter(v => v.status !== 'pending')
    const approvedCount = resolvedToday.filter(v => ['approved', 'inside', 'exited'].includes(v.status)).length
    const approvalRate = resolvedToday.length === 0 ? 0 : Math.round((approvedCount / resolvedToday.length) * 100)
    
    const aWeekAgo = new Date()
    aWeekAgo.setDate(aWeekAgo.getDate() - 7)
    const thisWeekVisitors = societyVisitors.filter(v => new Date(v.entryTimestamp) > aWeekAgo)

    setRealStats({
      todayVisitors: todayVisitors.length,
      currentlyInside: insideCount,
      approvalRate,
      weekVisitors: thisWeekVisitors.length
    })

    // Calculate Weekly Trend
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dayStr = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
      const ds = new Date(d.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().slice(0, 10) // IST date string

      const daysVisits = societyVisitors.filter(v => v.date === ds)
      const daysApproved = daysVisits.filter(v => ['approved', 'inside', 'exited'].includes(v.status)).length
      
      last7Days.push({
        day: dayStr,
        visitors: daysVisits.length,
        approved: daysApproved
      })
    }
    setWeeklyTrend(last7Days)

  }, [societyVisitors])

  const riskDistribution = React.useMemo(() => {
    let high = 0, medium = 0, low = 0
    societyVisitors.forEach(v => {
      if (v.status === 'rejected' || v.faceMatch === 'mismatch' || v.faceMatch === 'failed') high++
      else if (v.status === 'pending') medium++
      else low++
    })
    
    const total = high + medium + low
    if (total === 0) return [
      { name: 'Low Risk', value: 100, color: '#10b981' },
      { name: 'Medium Risk', value: 0, color: '#f59e0b' },
      { name: 'High Risk', value: 0, color: '#ef4444' }
    ]

    return [
      { name: 'Low Risk', value: Math.round((low/total)*100), color: '#10b981' },
      { name: 'Medium Risk', value: Math.round((medium/total)*100), color: '#f59e0b' },
      { name: 'High Risk', value: Math.round((high/total)*100), color: '#ef4444' }
    ]
  }, [societyVisitors])

  const stats = [
    { label: 'Visitors Today', value: realStats.todayVisitors, icon: Users, color: 'blue', trend: '', up: true },
    { label: 'Currently Inside', value: realStats.currentlyInside, icon: MapPin, color: 'green', trend: '', up: true },
    { label: 'Approval Rate', value: `${realStats.approvalRate}%`, icon: CheckCircle, color: 'emerald', trend: '', up: true },
    { label: 'Active Alerts', value: activeAlerts.filter(a => !a.resolved).length, icon: AlertTriangle, color: 'red', trend: '', up: false },
    { label: 'This Week', value: realStats.weekVisitors, icon: TrendingUp, color: 'purple', trend: '', up: true },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <div key={i} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-${stat.color}-500/15 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 text-${stat.color}-400`} />
                </div>
                {stat.trend && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${stat.up ? 'text-green-400' : 'text-red-400'}`}>
                    {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Weekly Visitor Trend</h3>
            <button className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={weeklyTrend}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Area type="monotone" dataKey="visitors" stroke="#6366f1" fill="url(#colorVisitors)" strokeWidth={2} />
              <Area type="monotone" dataKey="approved" stroke="#10b981" fill="url(#colorApproved)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Distribution */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Risk Distribution</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={220}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {riskDistribution.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <div>
                    <p className="text-sm text-white">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.value}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Recent Alerts */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Recent Alerts
            </h3>
            <button onClick={() => onNavigate('alerts')} className="text-xs text-indigo-400 flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {activeAlerts && activeAlerts.slice(0, 4).map(alert => (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                alert.type === 'critical' ? 'bg-red-500/5 border-red-500/15' :
                alert.type === 'warning' ? 'bg-amber-500/5 border-amber-500/15' :
                'bg-blue-500/5 border-blue-500/15'
              }`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  alert.type === 'critical' ? 'bg-red-500 pulse-dot' :
                  alert.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{alert.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{alert.message}</p>
                  <p className="text-[10px] text-slate-600 mt-1">{getTimeAgo(alert.timestamp)}</p>
                </div>
                {!alert.resolved && (
                  <button className="text-xs text-indigo-400 hover:text-indigo-300 flex-shrink-0">Resolve</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function VisitorsSection({ societyVisitors, societyGuards }) {
  const [selectedVisitor, setSelectedVisitor] = useState(null)
  
  const getGuardName = (uid) => {
    const guard = societyGuards?.find(g => g.uid === uid || g.id === uid)
    return guard ? guard.name || guard.email : 'Unknown Guard'
  }

  // Display only real visitors, reversed so newest is first
  const displayVisitors = [...(societyVisitors || [])].reverse()

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-white">All Visitors</h2>
        <div className="flex items-center gap-2">
          <button className="btn-outline text-xs py-2 px-3">
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
          <button className="btn-outline text-xs py-2 px-3">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search by name, phone, or flat..." className="input-field pl-10" />
        </div>
        <select className="input-field w-auto">
          <option>All Status</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
          <option>Inside</option>
          <option>Exited</option>
        </select>
        <select className="input-field w-auto">
          <option>All Risk</option>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Visitor</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Phone</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Purpose</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Flat</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Status</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Trust</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Risk</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Time</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Guard</th>
              </tr>
            </thead>
            <tbody>
              {displayVisitors.map(v => (
                <tr key={v.id} onClick={() => setSelectedVisitor(v)} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                        {v.name?.charAt(0) || '?'}
                      </div>
                      <span className="text-sm text-white">{v.name}</span>
                      {v.purpose?.toLowerCase().includes('delivery') && <Truck className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{v.phone}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{v.purpose}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{v.flatGate || v.flat}</td>
                  <td className="px-4 py-3"><span className={`badge ${getStatusColor(v.status)}`}>{getStatusLabel(v.status)}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-slate-800">
                        <div className="h-full rounded-full" style={{ width: `${v.trustScore || 85}%`, backgroundColor: getTrustColor(v.trustScore || 85) }} />
                      </div>
                      <span className="text-xs" style={{ color: getTrustColor(v.trustScore || 85) }}>{v.trustScore || 85}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${getRiskBadge(v.riskLevel || 'Low')}`}>{v.riskLevel || 'Low'}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{getTimeAgo(v.entryTimestamp)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{getGuardName(v.enteredBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visitor Detail Modal */}
      {selectedVisitor && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedVisitor(null)}>
          <div className="glass-card w-full max-w-lg p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Visitor Details</h3>
              <button onClick={() => setSelectedVisitor(null)} className="p-2 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-500">
                  {selectedVisitor.name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{selectedVisitor.name}</p>
                  <p className="text-sm text-slate-400">{selectedVisitor.phone}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`badge ${getStatusColor(selectedVisitor.status)}`}>{getStatusLabel(selectedVisitor.status)}</span>
                    <span className={`badge ${getRiskBadge(selectedVisitor.riskLevel || 'Low')}`}>{selectedVisitor.riskLevel || 'Low'} Risk</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Purpose', value: selectedVisitor.purpose },
                  { label: 'Flat', value: selectedVisitor.flatGate || selectedVisitor.flat },
                  { label: 'Guard', value: getGuardName(selectedVisitor.enteredBy) },
                  { label: 'Gate', value: selectedVisitor.gate || 'Main Gate' },
                  { label: 'Trust Score', value: `${selectedVisitor.trustScore || 85}/100` },
                  { label: 'Face Match', value: selectedVisitor.faceMatch || '98%' },
                  { label: 'Entry Time', value: selectedVisitor.entryTimestamp ? formatDateTime(selectedVisitor.entryTimestamp) : '—' },
                  { label: 'Exit Time', value: selectedVisitor.exitTimestamp ? formatDateTime(selectedVisitor.exitTimestamp) : '—' },
                ].map((field, i) => (
                  <div key={i}>
                    <p className="text-xs text-slate-500">{field.label}</p>
                    <p className="text-sm text-white">{field.value}</p>
                  </div>
                ))}
              </div>
              {selectedVisitor.riskReason && (
                <div className={`p-3 rounded-xl ${selectedVisitor.riskLevel === 'High' ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                  <p className="text-xs text-slate-400 mb-1">AI Risk Assessment</p>
                  <p className="text-sm text-white">{selectedVisitor.riskReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AlertsSection({ activeAlerts }) {
  const [filter, setFilter] = useState('All')
  
  const displayAlerts = activeAlerts.filter(a => {
    if (filter === 'All') return true
    if (filter === 'Resolved') return a.resolved
    return !a.resolved && a.type.toLowerCase() === filter.toLowerCase()
  })

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-bold text-white">Security Alerts</h2>
        <div className="flex gap-2 flex-wrap">
          {['All', 'Critical', 'Warning', 'Resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              f === filter ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800/60 text-slate-400 border border-slate-700'
            }`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {displayAlerts.length === 0 ? (
          <div className="text-center p-12 bg-slate-800/20 rounded-xl border border-slate-700/30">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-white">Secure and Clear</p>
            <p className="text-sm text-slate-400 mt-1">No security alerts are active in the society.</p>
          </div>
        ) : (
          displayAlerts.map(alert => (
            <div key={alert.id} className={`glass-card p-4 border-l-4 ${
              alert.type === 'critical' ? 'border-l-red-500' :
              alert.type === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500'
            } ${alert.resolved ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    alert.type === 'critical' ? 'bg-red-500/15' :
                    alert.type === 'warning' ? 'bg-amber-500/15' : 'bg-blue-500/15'
                  }`}>
                    {alert.type === 'critical' ? <AlertTriangle className="w-5 h-5 text-red-400" /> :
                     alert.type === 'warning' ? <AlertCircle className="w-5 h-5 text-amber-400" /> :
                     <Zap className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{alert.title}</p>
                      <span className={`badge ${
                        alert.type === 'critical' ? 'badge-danger' :
                        alert.type === 'warning' ? 'badge-warning' : 'badge-info'
                      }`}>{alert.type}</span>
                      {alert.resolved && <span className="badge badge-success">Resolved</span>}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{alert.message}</p>
                    <p className="text-xs text-slate-600 mt-2">{getTimeAgo(alert.timestamp)}</p>
                  </div>
                </div>
                {!alert.resolved && (
                  <button className="btn-outline text-xs py-1.5 px-3 flex-shrink-0 cursor-not-allowed opacity-50" title="Connect to backend to resolve alerts">
                    <CheckCircle className="w-3 h-3" /> Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function AnalyticsSection({ societyVisitors }) {
  const [periodDays, setPeriodDays] = useState(7)
  const [chartsData, setChartsData] = useState({
    trend: [],
    topFlats: [],
    hourly: []
  })
  const [dateRangeStr, setDateRangeStr] = useState('')

  useEffect(() => {
    if (!societyVisitors) return

    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - (periodDays - 1))
    
    // Format Date Range String
    const formatDate = (date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
    setDateRangeStr(`${formatDate(startDate)} - ${formatDate(now)}`)

    // Pre-calculate date boundaries
    const startObj = new Date(startDate.setHours(0,0,0,0))
    const endObj = new Date(now.setHours(23,59,59,999))

    // Filter relevant visitors
    const periodVisitors = societyVisitors.filter(v => {
      const vDate = new Date(v.entryTimestamp)
      return vDate >= startObj && vDate <= endObj
    })

    // 1. Weekly Trend (or period trend)
    const trendMap = {}
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const istString = new Date(d.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().slice(0, 10)
      trendMap[istString] = { day: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), approved: 0, rejected: 0 }
    }

    // 2. Top Flats
    const flatCounts = {}

    // 3. Hourly visits
    const hourlyCounts = Array.from({ length: 24 }, (_, i) => ({
      hour: i.toString().padStart(2, '0'),
      visitors: 0
    }))

    periodVisitors.forEach(v => {
      // Trend
      if (trendMap[v.date]) {
         if (['approved', 'inside', 'exited'].includes(v.status)) trendMap[v.date].approved++
         if (v.status === 'rejected') trendMap[v.date].rejected++
      }

      // Flats
      if (v.flatGate && v.flatGate !== 'Gate') {
        flatCounts[v.flatGate] = (flatCounts[v.flatGate] || 0) + 1
      }

      // Hourly
      const entryDate = new Date(v.entryTimestamp)
      // Convert to IST hour roughly
      const entryHour = new Date(entryDate.getTime() + (5.5 * 60 * 60 * 1000)).getUTCHours()
      hourlyCounts[entryHour].visitors++
    })

    const topFlats = Object.entries(flatCounts)
      .map(([flat, visits]) => ({ flat, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10)

    setChartsData({
      trend: Object.values(trendMap),
      topFlats,
      hourly: hourlyCounts
    })

  }, [societyVisitors, periodDays])

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Analytics Dashboard</h2>
        <div className="flex gap-4 items-center">
          <span className="text-sm font-medium text-emerald-400">{dateRangeStr}</span>
          <div className="flex gap-2">
            <select 
              value={periodDays}
              onChange={e => setPeriodDays(Number(e.target.value))}
              className="input-field w-auto text-xs py-2"
            >
              <option value={7}>Last 7 days</option>
              <option value={15}>Last 15 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <button className="btn-outline text-xs py-2 px-3 flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Weekly trend full width */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Visitor Trends ({periodDays} Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartsData.trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }} />
            <Legend />
            <Bar dataKey="approved" fill="#10b981" radius={[4, 4, 0, 0]} name="Approved" />
            <Bar dataKey="rejected" fill="#ef4444" radius={[4, 4, 0, 0]} name="Rejected" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Visited Flats */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top 10 Most Visited Flats</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartsData.topFlats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" stroke="#64748b" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="flat" stroke="#64748b" fontSize={12} width={50} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="visits" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Distribution */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Hourly Visitor Distribution (Over Period)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartsData.hourly}>
              <defs>
                <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" stroke="#64748b" fontSize={10} interval={1} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="visitors" stroke="#0ea5e9" fill="url(#hourlyGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function HeatmapSection({ societyVisitors }) {
  const [heatmapData, setHeatmapData] = useState([])
  const [peakHoursData, setPeakHoursData] = useState([])
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const hours = Array.from({ length: 24 }, (_, i) => i)

  useEffect(() => {
    if (!societyVisitors) return

    const now = new Date()
    const aWeekAgo = new Date(now)
    aWeekAgo.setDate(aWeekAgo.getDate() - 7)

    const recentVisitors = societyVisitors.filter(v => new Date(v.entryTimestamp) > aWeekAgo)
    
    // Process Heatmap
    const heatMapCounters = {}
    // Process Peak Hours Over Last 7 days
    const hourCounters = Array.from({ length: 24 }, (_, i) => ({ hour: i.toString().padStart(2, '0'), visitors: 0 }))

    recentVisitors.forEach(v => {
      const entryDate = new Date(v.entryTimestamp)
      // IST adjustment roughly
      const entryTimeIST = new Date(entryDate.getTime() + (5.5 * 60 * 60 * 1000))
      
      const dayName = days[entryTimeIST.getUTCDay()]
      const hour = entryTimeIST.getUTCHours()

      const key = `${dayName}-${hour}`
      heatMapCounters[key] = (heatMapCounters[key] || 0) + 1
      
      hourCounters[hour].visitors++
    })

    const newHeatmapData = []
    days.forEach(d => {
      hours.forEach(h => {
        newHeatmapData.push({
          day: d,
          hour: h,
          value: heatMapCounters[`${d}-${h}`] || 0
        })
      })
    })

    setHeatmapData(newHeatmapData)

    // Only show hours from 6 AM to 10 PM for Peak Hours
    setPeakHoursData(hourCounters.filter((_, i) => i >= 6 && i <= 22))

  }, [societyVisitors])

  const getHeatColor = (value) => {
    if (value === 0) return 'bg-slate-800/50'
    if (value <= 2) return 'bg-indigo-900/40'
    if (value <= 4) return 'bg-indigo-700/40'
    if (value <= 6) return 'bg-indigo-600/50'
    if (value <= 8) return 'bg-indigo-500/60'
    if (value <= 10) return 'bg-indigo-400/70'
    return 'bg-indigo-300/80'
  }

  const getValue = (day, hour) => {
    const entry = heatmapData.find(d => d.day === day && d.hour === hour)
    return entry ? entry.value : 0
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Security Heatmap</h2>
          <p className="text-sm text-slate-500">Visitor density by day and hour (last 7 days)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Low</span>
            <div className="flex gap-0.5">
              {['bg-slate-800/50', 'bg-indigo-900/40', 'bg-indigo-700/40', 'bg-indigo-600/50', 'bg-indigo-500/60', 'bg-indigo-400/70', 'bg-indigo-300/80'].map((c, i) => (
                <div key={i} className={`w-4 h-4 rounded ${c}`} />
              ))}
            </div>
            <span className="text-xs text-slate-500">High</span>
          </div>
        </div>
      </div>

      <div className="glass-card p-5 overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Hour labels */}
          <div className="flex mb-1">
            <div className="w-12 flex-shrink-0" />
            {hours.map(h => (
              <div key={h} className="flex-1 text-center text-[10px] text-slate-500">
                {h % 3 === 0 ? `${h.toString().padStart(2, '0')}` : ''}
              </div>
            ))}
          </div>

          {/* Grid */}
          {days.map(day => (
            <div key={day} className="flex gap-0.5 mb-0.5">
              <div className="w-12 flex-shrink-0 text-xs text-slate-400 flex items-center">{day}</div>
              {hours.map(h => {
                const val = getValue(day, h)
                return (
                  <div
                    key={h}
                    className={`flex-1 aspect-square rounded-sm ${getHeatColor(val)} hover:ring-1 hover:ring-indigo-400 transition-all cursor-pointer`}
                    title={`${day} ${h}:00 — ${val} visitors`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Additional charts */}
      <div className="grid grid-cols-1 gap-6">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Peak Hours Analysis (Full Week Aggregate)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={peakHoursData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="visitors" radius={[4, 4, 0, 0]}>
                {peakHoursData.map((entry, i) => (
                  <Cell key={i} fill={entry.visitors > 10 ? '#ef4444' : entry.visitors > 6 ? '#f59e0b' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function VerifyResidentsSection() {
  const { user } = useContext(AuthContext)
  const [residents, setResidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  useEffect(() => {
    fetchResidents()
  }, [])

  const fetchResidents = async () => {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'resident'),
        where('societyName', '==', user.societyName)
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setResidents(data)
    } catch (err) {
      console.error(err)
      if (err.message.includes('permission') || err.message.includes('Missing or insufficient')) {
        alert("Firestore Permission Denied!\n\nPlease update your Firestore Security Rules to allow Admins to read the users collection:\n\nmatch /users/{userId} {\n  allow read: if request.auth != null;\n  allow write: if request.auth.uid == userId || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';\n}")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'users', id), { status: newStatus })
      fetchResidents()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = (id) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = async () => {
    if (!deleteConfirmId) return
    try {
      await deleteDoc(doc(db, 'users', deleteConfirmId))
      fetchResidents()
    } catch (err) {
      console.error(err)
    } finally {
      setDeleteConfirmId(null)
    }
  }

  const filteredResidents = residents.filter(r => {
    const matchesFilter = filter === 'All' ? true : r.status?.toLowerCase() === filter.toLowerCase()
    const matchesSearch = r.name?.toLowerCase().includes(searchQuery.toLowerCase()) || r.flatGate?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const counts = {
    total: residents.length,
    approved: residents.filter(r => r.status === 'approved').length,
    pending: residents.filter(r => r.status === 'pending').length,
    rejected: residents.filter(r => r.status === 'rejected').length
  }

  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-lg font-bold text-white">Verify Residents</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[{ label: 'Total', value: counts.total, color: 'blue' },
          { label: 'Pending', value: counts.pending, color: 'amber' },
          { label: 'Approved', value: counts.approved, color: 'green' },
          { label: 'Rejected', value: counts.rejected, color: 'red' }
        ].map((c, i) => (
          <div key={i} className={`glass-card p-4 border-${c.color}-500/20`}>
            <p className={`text-2xl font-bold text-${c.color}-400`}>{c.value}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex gap-2 bg-slate-800/40 p-1 rounded-xl">
          {['All', 'Pending', 'Approved', 'Rejected'].map(f => (
             <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
               filter === f ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
             }`}>{f}</button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
           <input type="text" placeholder="Search by name or flat..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input-field pl-10 h-full py-2" />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? <p className="text-slate-500 p-4 text-center">Loading residents...</p> : 
         filteredResidents.length === 0 ? <p className="text-slate-500 p-4 text-center bg-slate-800/20 rounded-xl border border-dashed border-slate-700">No results found.</p> :
         filteredResidents.map(res => (
          <div key={res.id} className="glass-card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-400">
                {res.name?.charAt(0) || 'U'}
              </div>
              <div>
                <p className="font-medium text-white">{res.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-400"><span className="text-slate-500">Flat:</span> {res.flatGate}</span>
                  <span className="text-xs text-slate-400"><span className="text-slate-500">Phone:</span> {res.phoneNumber}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`badge ${res.status === 'approved' ? 'badge-success' : res.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                {res.status || 'pending'}
              </span>
              
              {res.status !== 'approved' && (
                <button onClick={() => handleUpdateStatus(res.id, 'approved')} className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20" title="Approve">
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
              {res.status !== 'rejected' && (
                <button onClick={() => handleUpdateStatus(res.id, 'rejected')} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20" title="Reject">
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => handleDelete(res.id)} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-red-400" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full p-6 text-center animate-fade-in border border-red-500/30">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Delete Resident?</h3>
            <p className="text-slate-400 mb-6 text-sm">Do you really want to permanently delete this user? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="btn-outline flex-1">Cancel</button>
              <button onClick={confirmDelete} className="btn-danger flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GuardsSection({ societyVisitors }) {
  const { user } = useContext(AuthContext)
  const [guards, setGuards] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [editGuardId, setEditGuardId] = useState(null)
  const [formError, setFormError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '', shift: '', gate: '', photo: ''
  })
  
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchGuards()
  }, [])

  const fetchGuards = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'guard'), where('societyName', '==', user.societyName))
      const snapshot = await getDocs(q)
      setGuards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch(err) {
      console.error(err)
    }
  }

  const handleImageDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0]
    if (!file) return
    
    // Convert to base64 with canvas compression
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 400
        const scaleSize = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scaleSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        setFormData(prev => ({ ...prev, photo: base64 }))
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleCreateGuard = async (e) => {
    e.preventDefault()
    setLoading(true)
    setFormError('')
    try {
      if (!validatePhoneFormat(formData.phone)) {
        throw new Error('Phone number must be +91 followed by 10 digits.')
      }
      const isUnique = await checkPhoneUnique(formData.phone, editGuardId)
      if (!isUnique) {
        throw new Error('This phone number is already registered to another account.')
      }

      if (editGuardId) {
        await updateDoc(doc(db, 'users', editGuardId), {
          name: formData.name,
          phoneNumber: formData.phone,
          flatGate: formData.gate,
          shift: formData.shift,
          photo: formData.photo
        })
      } else {
        const credential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password)
        
        const newGuard = {
          uid: credential.user.uid,
          name: formData.name,
          email: formData.email,
          role: 'guard',
          phoneNumber: formData.phone,
          societyName: user.societyName,
          flatGate: formData.gate,
          shift: formData.shift,
          photo: formData.photo,
          status: 'approved',
          createdAt: new Date().toISOString()
        }
        
        await setDoc(doc(db, 'users', credential.user.uid), newGuard)
      }
      setShowAdd(false)
      setEditGuardId(null)
      setFormData({ name: '', email: '', password: '', phone: '', shift: '', gate: '', photo: '' })
      fetchGuards()
    } catch(err) {
      setFormError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGuard = (id) => {
    setDeleteConfirmId(id)
  }
  
  const confirmDeleteGuard = async () => {
    if (!deleteConfirmId) return
    try {
      await deleteDoc(doc(db, 'users', deleteConfirmId))
      fetchGuards()
    } catch(e) {
      console.error(e)
    } finally {
      setDeleteConfirmId(null)
    }
  }

  const handleEditGuard = (guard) => {
    setFormData({
      name: guard.name || '',
      email: guard.email || '',
      password: '',
      phone: guard.phoneNumber || '',
      shift: guard.shift || '',
      gate: guard.flatGate || guard.gate || '',
      photo: guard.photo || ''
    })
    setEditGuardId(guard.id)
    setShowAdd(true)
  }

  const filteredGuards = guards.filter(g => g.name?.toLowerCase().includes(searchQuery.toLowerCase()) || g.flatGate?.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-white flex-shrink-0">Guard Management</h2>
        <div className="flex w-full md:w-auto items-center gap-3">
          <div className="relative w-full md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
             <input type="text" placeholder="Search by name or gate..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input-field pl-10 h-full py-2" />
          </div>
          <button onClick={() => { setShowAdd(!showAdd); setEditGuardId(null); setFormData({ name: '', email: '', password: '', phone: '', shift: '', gate: '', photo: '' }) }} className="btn-primary py-2 px-4 shadow-lg shadow-indigo-500/25 flex-shrink-0">
            {showAdd ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {showAdd ? 'Cancel' : 'Add Guard'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="glass-card p-6 mb-6 animate-fade-in border border-indigo-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">
              {editGuardId ? 'Edit Guard Profile' : 'Create Guard Profile'}
            </h3>
            {editGuardId && <span className="badge badge-warning text-[10px]">Editing Mode</span>}
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg mb-4">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateGuard} className="space-y-4">
            
            <div className="flex flex-col md:flex-row gap-6">
              {/* Image Uploader */}
              <div 
                className="w-full md:w-1/3 aspect-square max-h-[250px] bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleImageDrop}
                onClick={() => fileInputRef.current.click()}
              >
                {formData.photo ? (
                  <img src={formData.photo} alt="Guard" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-slate-500 mb-2" />
                    <p className="text-xs text-slate-400 text-center px-4">Click or Drag & Drop Photo</p>
                  </>
                )}
                <input type="file" hidden ref={fileInputRef} onChange={handleImageDrop} accept="image/*" />
              </div>

              {/* Form Fields */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                    <input type="text" required className="input-field py-2 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Phone Number</label>
                    <input type="tel" required className="input-field py-2 text-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Email (For Login)</label>
                    <input type="email" required={!editGuardId} disabled={!!editGuardId} className={`input-field py-2 text-sm ${editGuardId ? 'opacity-50 cursor-not-allowed' : ''}`} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  {!editGuardId && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Password</label>
                      <input type="password" required minLength="6" className="input-field py-2 text-sm" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Gate / Post</label>
                    <input type="text" required placeholder="e.g. Main Gate" className="input-field py-2 text-sm" value={formData.gate} onChange={e => setFormData({...formData, gate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Shift Details</label>
                    <input type="text" required placeholder="e.g. 08:00 AM - 08:00 PM" className="input-field py-2 text-sm" value={formData.shift} onChange={e => setFormData({...formData, shift: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button disabled={loading} type="submit" className="btn-primary py-2 px-6">
                {loading ? 'Saving...' : editGuardId ? 'Save Changes' : 'Create Guard Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {filteredGuards.length === 0 ? (
        <p className="text-slate-500 p-4 text-center bg-slate-800/20 rounded-xl border border-dashed border-slate-700">No results found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGuards.map((guard, i) => (
            <div key={guard.id || i} className="glass-card p-5 relative overflow-hidden group">
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => handleEditGuard(guard)} className="p-1.5 bg-slate-800 text-slate-400 rounded-lg hover:text-indigo-400"><Edit className="w-4 h-4" /></button>
                 <button onClick={() => handleDeleteGuard(guard.id)} className="p-1.5 bg-slate-800 text-slate-400 rounded-lg hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                {guard.photo ? (
                  <img src={guard.photo} alt={guard.name} className="w-full h-full object-cover" />
                ) : (
                  <UserCog className="w-8 h-8 text-slate-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-base font-semibold text-white">{guard.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5"><span className="text-slate-500">Gate:</span> {guard.flatGate || guard.gate}</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-400 flex flex-col gap-1">
                   <p><span className="text-slate-500">Email:</span> {guard.email}</p>
                   <p><span className="text-slate-500">Phone:</span> {guard.phoneNumber}</p>
                   <p><span className="text-slate-500">Shift:</span> {guard.shift}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800/50">
              <div>
                <p className="text-xs text-slate-500">Entries Logged</p>
                <p className="text-xl font-bold text-white">
                  {societyVisitors ? societyVisitors.filter(v => v.enteredBy === guard.uid || v.enteredBy === guard.id).length : 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
                  <p className="text-sm font-medium text-white">Active</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full p-6 text-center animate-fade-in border border-red-500/30">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Delete Guard?</h3>
            <p className="text-slate-400 mb-6 text-sm">Do you really want to permanently eliminate this guard profile? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="btn-outline flex-1">Cancel</button>
              <button onClick={confirmDeleteGuard} className="btn-danger flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsSection() {
  const { user, setUser } = useContext(AuthContext)
  const [loading, setLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileData, setProfileData] = useState({
    name: user.name || '',
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    flatGate: user.flatGate || ''
  })

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
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
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-lg font-bold text-white">Admin Settings</h2>

      <div className="glass-card p-5 space-y-4 border border-indigo-500/20">
        <h3 className="text-sm font-semibold text-indigo-400">Your Profile (Admin)</h3>

        {profileError && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg">
            {profileError}
          </div>
        )}
        {profileSuccess && (
          <div className="bg-green-500/10 border border-green-500/50 text-green-500 text-sm p-3 rounded-lg">
            {profileSuccess}
          </div>
        )}

        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Full Name</label>
              <input type="text" value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email Address</label>
              <input type="email" value={profileData.email} disabled className="input-field opacity-50 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Phone Number</label>
              <input type="tel" value={profileData.phoneNumber} onChange={(e) => setProfileData({...profileData, phoneNumber: e.target.value})} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Flat Number</label>
              <input type="text" value={profileData.flatGate} disabled className="input-field opacity-50 cursor-not-allowed" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Update Profile'}
          </button>
        </form>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Society Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Society Name</label>
            <input type="text" defaultValue={user.societyName || "Green Valley Apartments"} disabled className="input-field opacity-50 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Address</label>
            <input type="text" defaultValue="Sector 42, Noida, UP" className="input-field" />
          </div>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Security Rules</h3>
        <div className="space-y-3">
          {[
            { label: 'Auto-approve known delivery platforms', checked: true },
            { label: 'Require face match for re-entry', checked: true },
            { label: 'Block visitors with trust score below 20', checked: false },
            { label: 'Send alerts for late-night entries (10PM–6AM)', checked: true },
            { label: 'Enable society-wide blocklist sharing', checked: true },
            { label: 'Auto-flag visitors to 3+ flats in same day', checked: true },
          ].map((rule, i) => (
            <label key={i} className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-slate-800/30">
              <span className="text-sm text-slate-300">{rule.label}</span>
              <div className={`w-10 h-6 rounded-full transition-colors relative ${rule.checked ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                <div className={`absolute w-4 h-4 rounded-full bg-white top-1 transition-transform ${rule.checked ? 'left-5' : 'left-1'}`} />
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

