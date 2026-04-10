import { useState, useContext } from 'react'
import { AuthContext } from '../App'
import {
  Shield, LogOut, Bell, LayoutDashboard, Users, AlertTriangle,
  BarChart3, UserCog, Settings, Search, Download, CheckCircle,
  XCircle, Clock, TrendingUp, Eye, Ban, MapPin, FileText,
  ChevronRight, Filter, RefreshCw, ChevronDown, X, Activity,
  Truck, AlertCircle, Zap, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import {
  mockVisitors, mockAlerts, mockAnalytics,
  formatDateTime, getTimeAgo, getStatusColor, getStatusLabel,
  getRiskBadge, getTrustColor
} from '../data/mockData'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext)
  const [activeSection, setActiveSection] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'visitors', label: 'Visitors', icon: Users },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: mockAlerts.filter(a => !a.resolved).length },
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="flex-1 text-left">{item.label}</span>}
                {sidebarOpen && item.badge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user.avatar}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500">Admin</p>
              </div>
            )}
            <button onClick={logout} className="p-2 rounded-lg text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
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
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors hidden lg:block">
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
              <button className="relative p-2 rounded-xl bg-slate-800/60 text-slate-400 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center">
                  {mockAlerts.filter(a => !a.resolved).length}
                </span>
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* OVERVIEW */}
          {activeSection === 'overview' && <OverviewSection onNavigate={setActiveSection} />}

          {/* VISITORS */}
          {activeSection === 'visitors' && <VisitorsSection />}

          {/* ALERTS */}
          {activeSection === 'alerts' && <AlertsSection />}

          {/* ANALYTICS */}
          {activeSection === 'analytics' && <AnalyticsSection />}

          {/* HEATMAP */}
          {activeSection === 'heatmap' && <HeatmapSection />}

          {/* GUARDS */}
          {activeSection === 'guards' && <GuardsSection />}

          {/* SETTINGS */}
          {activeSection === 'settings' && <SettingsSection />}
        </div>
      </main>
    </div>
  )
}

function OverviewSection({ onNavigate }) {
  const stats = [
    { label: 'Visitors Today', value: mockAnalytics.todayVisitors, icon: Users, color: 'blue', trend: '+12%', up: true },
    { label: 'Currently Inside', value: mockAnalytics.currentlyInside, icon: MapPin, color: 'green', trend: '', up: true },
    { label: 'Approval Rate', value: `${mockAnalytics.approvalRate}%`, icon: CheckCircle, color: 'emerald', trend: '+2.3%', up: true },
    { label: 'Active Alerts', value: mockAlerts.filter(a => !a.resolved).length, icon: AlertTriangle, color: 'red', trend: '-1', up: false },
    { label: 'This Week', value: mockAnalytics.weekVisitors, icon: TrendingUp, color: 'purple', trend: '+8%', up: true },
    { label: 'Avg Entry Time', value: mockAnalytics.avgEntryTime, icon: Clock, color: 'amber', trend: '', up: true },
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
            <AreaChart data={mockAnalytics.weeklyTrend}>
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
                  data={mockAnalytics.riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {mockAnalytics.riskDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {mockAnalytics.riskDistribution.map((item, i) => (
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            {mockAlerts.slice(0, 4).map(alert => (
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

        {/* Frequent Unknown Visitors */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" /> Frequent Unknown Visitors
          </h3>
          <div className="space-y-2">
            {mockAnalytics.frequentUnknown.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                  {v.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{v.name}</p>
                  <p className="text-xs text-slate-500">{v.phone} • {v.visits} visits • {v.rejections} rejections</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: getTrustColor(v.trustScore) }}>
                    {v.trustScore}
                  </span>
                  <button className="p-1 rounded text-slate-500 hover:text-red-400">
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function VisitorsSection() {
  const [selectedVisitor, setSelectedVisitor] = useState(null)

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
              {mockVisitors.map(v => (
                <tr key={v.id} onClick={() => setSelectedVisitor(v)} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                        {v.name.charAt(0)}
                      </div>
                      <span className="text-sm text-white">{v.name}</span>
                      {v.isDelivery && <Truck className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{v.phone}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{v.purpose}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{v.flat}</td>
                  <td className="px-4 py-3"><span className={`badge ${getStatusColor(v.status)}`}>{getStatusLabel(v.status)}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-slate-800">
                        <div className="h-full rounded-full" style={{ width: `${v.trustScore}%`, backgroundColor: getTrustColor(v.trustScore) }} />
                      </div>
                      <span className="text-xs" style={{ color: getTrustColor(v.trustScore) }}>{v.trustScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${getRiskBadge(v.riskLevel)}`}>{v.riskLevel}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{getTimeAgo(v.timestamp)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{v.guardName}</td>
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
                  {selectedVisitor.name.charAt(0)}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{selectedVisitor.name}</p>
                  <p className="text-sm text-slate-400">{selectedVisitor.phone}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`badge ${getStatusColor(selectedVisitor.status)}`}>{getStatusLabel(selectedVisitor.status)}</span>
                    <span className={`badge ${getRiskBadge(selectedVisitor.riskLevel)}`}>{selectedVisitor.riskLevel} Risk</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Purpose', value: selectedVisitor.purpose },
                  { label: 'Flat', value: selectedVisitor.flat },
                  { label: 'Guard', value: selectedVisitor.guardName },
                  { label: 'Gate', value: selectedVisitor.gate },
                  { label: 'Trust Score', value: `${selectedVisitor.trustScore}/100` },
                  { label: 'Face Match', value: selectedVisitor.faceMatch },
                  { label: 'Entry Time', value: selectedVisitor.entryTime ? formatDateTime(selectedVisitor.entryTime) : '—' },
                  { label: 'Exit Time', value: selectedVisitor.exitTime ? formatDateTime(selectedVisitor.exitTime) : '—' },
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

function AlertsSection() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Security Alerts</h2>
        <div className="flex gap-2">
          {['All', 'Critical', 'Warning', 'Info', 'Resolved'].map(f => (
            <button key={f} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              f === 'All' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800/60 text-slate-400 border border-slate-700'
            }`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {mockAlerts.map(alert => (
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
                <button className="btn-outline text-xs py-1.5 px-3 flex-shrink-0">
                  <CheckCircle className="w-3 h-3" /> Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsSection() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Analytics Dashboard</h2>
        <div className="flex gap-2">
          <select className="input-field w-auto text-xs py-2">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
          <button className="btn-outline text-xs py-2 px-3">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Weekly trend full width */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Visitor Trends (Weekly)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={mockAnalytics.weeklyTrend}>
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
            <BarChart data={mockAnalytics.topFlats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" stroke="#64748b" fontSize={12} />
              <YAxis type="category" dataKey="flat" stroke="#64748b" fontSize={12} width={50} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="visits" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Distribution */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Hourly Visitor Distribution (Today)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={mockAnalytics.hourlyData}>
              <defs>
                <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" stroke="#64748b" fontSize={10} interval={2} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="visitors" stroke="#0ea5e9" fill="url(#hourlyGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function HeatmapSection() {
  const { heatmapData } = mockAnalytics
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = Array.from({ length: 24 }, (_, i) => i)

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Peak Hours Analysis</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mockAnalytics.hourlyData.filter((_, i) => i >= 6 && i <= 22)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="visitors" radius={[4, 4, 0, 0]}>
                {mockAnalytics.hourlyData.filter((_, i) => i >= 6 && i <= 22).map((entry, i) => (
                  <Cell key={i} fill={entry.visitors > 10 ? '#ef4444' : entry.visitors > 6 ? '#f59e0b' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Geo-Tagged Entry Points</h3>
          <div className="h-[250px] rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Map View</p>
              <p className="text-xs text-slate-500">Leaflet.js integration (Connect API)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GuardsSection() {
  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-lg font-bold text-white">Guard Management</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockAnalytics.guardActivity.map((guard, i) => (
          <div key={i} className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl ${guard.status === 'active' ? 'bg-green-500/15' : 'bg-slate-800'} flex items-center justify-center`}>
                  <UserCog className={`w-6 h-6 ${guard.status === 'active' ? 'text-green-400' : 'text-slate-500'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{guard.guard}</p>
                  <p className="text-xs text-slate-500">{guard.gate}</p>
                </div>
              </div>
              <span className={`badge ${guard.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                {guard.status === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />}
                {guard.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <p className="text-xs text-slate-500">Entries Logged</p>
                <p className="text-xl font-bold text-white">{guard.entriesLogged}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Current Shift</p>
                <p className="text-sm font-medium text-white">{guard.shift}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsSection() {
  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-lg font-bold text-white">Society Settings</h2>

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Society Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Society Name</label>
            <input type="text" defaultValue="Green Valley Apartments" className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Address</label>
            <input type="text" defaultValue="Sector 42, Noida, UP" className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Total Flats</label>
            <input type="number" defaultValue="240" className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Number of Gates</label>
            <input type="number" defaultValue="3" className="input-field" />
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

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">API Integrations</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Cloudinary API Key</label>
            <input type="password" defaultValue="ck_••••••••••" className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">WhatsApp Cloud API Token</label>
            <input type="password" defaultValue="wa_••••••••••" className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Claude API Key (for AI Risk Assessment)</label>
            <input type="password" defaultValue="sk-••••••••••" className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Numverify API Key (Phone Validation)</label>
            <input type="password" defaultValue="nv_••••••••••" className="input-field" />
          </div>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Society-Wide Blocklist</h3>
        <div className="space-y-2">
          {[
            { phone: '+919333222111', name: 'Suspicious Person', reportedBy: 'Flat A-302' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/15">
              <div>
                <p className="text-sm text-white">{item.name}</p>
                <p className="text-xs text-slate-500">{item.phone} • Reported by {item.reportedBy}</p>
              </div>
              <button className="text-xs text-red-400 hover:text-red-300">Remove</button>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary">Save All Settings</button>
    </div>
  )
}
