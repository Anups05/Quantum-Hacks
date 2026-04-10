// Mock data for the entire application

export const mockVisitors = [
  {
    id: 'v1', name: 'Amit Verma', phone: '+919812345678', purpose: 'Guest',
    flat: 'A-302', status: 'pending', photo: null, timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    trustScore: 85, riskLevel: 'Low', riskReason: 'Regular visitor with clean history',
    guardName: 'Rajesh Kumar', gate: 'Main Gate', faceMatch: 'matched',
  },
  {
    id: 'v2', name: 'Delivery Boy - Swiggy', phone: '+919898765432', purpose: 'Delivery',
    flat: 'B-105', status: 'approved', photo: null, timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    trustScore: 72, riskLevel: 'Low', riskReason: 'Known delivery platform',
    guardName: 'Rajesh Kumar', gate: 'Main Gate', isDelivery: true, platform: 'Swiggy', faceMatch: 'first-time',
  },
  {
    id: 'v3', name: 'Suresh Patel', phone: '+919711122233', purpose: 'Service',
    flat: 'C-401', status: 'checked_in', photo: null, timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    entryTime: new Date(Date.now() - 40 * 60000).toISOString(),
    trustScore: 55, riskLevel: 'Medium', riskReason: 'Visited 3 different flats this week',
    guardName: 'Rajesh Kumar', gate: 'Main Gate', faceMatch: 'matched',
  },
  {
    id: 'v4', name: 'Unknown Male', phone: '+919600000111', purpose: 'Other',
    flat: 'A-201', status: 'rejected', photo: null, timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    trustScore: 22, riskLevel: 'High', riskReason: 'Face mismatch detected. Previously rejected twice this week.',
    guardName: 'Rajesh Kumar', gate: 'Main Gate', faceMatch: 'mismatch',
  },
  {
    id: 'v5', name: 'Ramesh Singh', phone: '+919876000123', purpose: 'Guest',
    flat: 'A-302', status: 'checked_out', photo: null, timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    entryTime: new Date(Date.now() - 5 * 3600000).toISOString(),
    exitTime: new Date(Date.now() - 3 * 3600000).toISOString(),
    trustScore: 92, riskLevel: 'Low', riskReason: 'Trusted frequent visitor',
    guardName: 'Rajesh Kumar', gate: 'Main Gate', faceMatch: 'matched',
  },
  {
    id: 'v6', name: 'Courier - Amazon', phone: '+919555444333', purpose: 'Delivery',
    flat: 'D-502', status: 'checked_out', photo: null, timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    entryTime: new Date(Date.now() - 4 * 3600000).toISOString(),
    exitTime: new Date(Date.now() - 3.8 * 3600000).toISOString(),
    trustScore: 78, riskLevel: 'Low', riskReason: 'Amazon delivery with valid tracking',
    guardName: 'Rajesh Kumar', gate: 'Main Gate', isDelivery: true, platform: 'Amazon', faceMatch: 'first-time',
  },
  {
    id: 'v7', name: 'Suspicious Person', phone: '+919333222111', purpose: 'Other',
    flat: 'B-301', status: 'rejected', photo: null, timestamp: new Date(Date.now() - 6 * 3600000).toISOString(),
    trustScore: 15, riskLevel: 'High',
    riskReason: 'Multiple rejected entries. Phone number flagged as potentially fake.',
    guardName: 'Sunil Yadav', gate: 'Side Gate', faceMatch: 'mismatch',
  },
]

export const mockAlerts = [
  {
    id: 'a1', type: 'critical', title: 'Face Mismatch Detected',
    message: 'Visitor "Unknown Male" photo does not match previous visit record for phone +919600000111',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), resolved: false, visitorId: 'v4',
  },
  {
    id: 'a2', type: 'warning', title: 'Multi-Flat Activity',
    message: 'Suresh Patel visited 3 different flats (C-401, A-102, B-205) in the past 7 days',
    timestamp: new Date(Date.now() - 1 * 3600000).toISOString(), resolved: false, visitorId: 'v3',
  },
  {
    id: 'a3', type: 'critical', title: 'Fake Phone Number',
    message: 'Phone +919333222111 flagged as VoIP/disposable number by verification service',
    timestamp: new Date(Date.now() - 6 * 3600000).toISOString(), resolved: true, visitorId: 'v7',
  },
  {
    id: 'a4', type: 'info', title: 'Late Night Entry Attempt',
    message: 'Entry attempt at 1:30 AM by visitor with trust score 35',
    timestamp: new Date(Date.now() - 20 * 3600000).toISOString(), resolved: true,
  },
  {
    id: 'a5', type: 'warning', title: 'Repeated Rejection',
    message: 'Visitor "Unknown Male" has been rejected 3 times in the past 7 days across different flats',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), resolved: false, visitorId: 'v4',
  },
]

export const mockNotifications = [
  {
    id: 'n1', type: 'visitor', title: 'New Visitor at Gate',
    message: 'Amit Verma wants to visit your flat A-302. Purpose: Guest.',
    read: false, timestamp: new Date(Date.now() - 5 * 60000).toISOString(), visitorId: 'v1',
  },
  {
    id: 'n2', type: 'approved', title: 'Visitor Checked In',
    message: 'Suresh Patel has checked in for flat C-401.',
    read: true, timestamp: new Date(Date.now() - 40 * 60000).toISOString(), visitorId: 'v3',
  },
  {
    id: 'n3', type: 'alert', title: 'Security Alert',
    message: 'Visitor with face mismatch detected at Main Gate.',
    read: false, timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
]

export const mockRecurringPasses = [
  { id: 'rp1', name: 'Sarita (Maid)', phone: '+919876111222', days: ['Mon', 'Wed', 'Fri', 'Sat'], timeWindow: '7:00 AM - 10:00 AM', active: true },
  { id: 'rp2', name: 'Vijay (Driver)', phone: '+919876333444', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], timeWindow: '7:30 AM - 8:30 AM', active: true },
  { id: 'rp3', name: 'Manoj (Cook)', phone: '+919876555666', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], timeWindow: '11:00 AM - 1:00 PM', active: false },
]

export const mockExpectedVisitors = [
  { id: 'ev1', name: 'Dr. Mehra', phone: '+919812000111', expectedDate: 'Today', timeWindow: '4:00 PM - 6:00 PM' },
  { id: 'ev2', name: 'Plumber - UrbanClap', phone: '+919812000222', expectedDate: 'Tomorrow', timeWindow: '10:00 AM - 12:00 PM' },
]

export const mockBlocklist = [
  { id: 'bl1', phone: '+919333222111', name: 'Suspicious Person', reason: 'Fake identity attempt', addedOn: '2026-03-20', societyWide: true },
  { id: 'bl2', phone: '+919444555666', name: 'Former Vendor', reason: 'Harassment complaint', addedOn: '2026-03-15', societyWide: false },
]

export const mockWatchlist = [
  { id: 'wl1', phone: '+919711122233', name: 'Suresh Patel', reason: 'Visited multiple flats', addedOn: '2026-03-22' },
]

export const mockChatMessages = [
  { id: 'm1', visitorId: 'v1', sender: 'guard', text: 'There is a guest at the gate for your flat. He says he is your cousin.', timestamp: new Date(Date.now() - 4 * 60000).toISOString() },
  { id: 'm2', visitorId: 'v1', sender: 'resident', text: 'Can you ask him my mother\'s name for verification?', timestamp: new Date(Date.now() - 3 * 60000).toISOString() },
  { id: 'm3', visitorId: 'v1', sender: 'guard', text: 'He said "Sunita ji". Is that correct?', timestamp: new Date(Date.now() - 2 * 60000).toISOString() },
  { id: 'm4', visitorId: 'v1', sender: 'resident', text: 'Yes, that\'s correct. Please let him in.', timestamp: new Date(Date.now() - 1 * 60000).toISOString() },
]

// Analytics data
export const mockAnalytics = {
  todayVisitors: 24,
  weekVisitors: 156,
  monthVisitors: 612,
  currentlyInside: 8,
  approvalRate: 87,
  rejectionRate: 13,
  avgEntryTime: '2.3 hrs',
  alertsToday: 3,

  // Hourly visitor distribution (24 hours)
  hourlyData: Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    visitors: i < 6 ? Math.floor(Math.random() * 3) :
      i < 10 ? Math.floor(Math.random() * 15 + 5) :
      i < 14 ? Math.floor(Math.random() * 10 + 3) :
      i < 18 ? Math.floor(Math.random() * 12 + 4) :
      i < 22 ? Math.floor(Math.random() * 8 + 2) :
      Math.floor(Math.random() * 3),
  })),

  // Weekly trend
  weeklyTrend: [
    { day: 'Mon', visitors: 28, approved: 24, rejected: 4 },
    { day: 'Tue', visitors: 22, approved: 19, rejected: 3 },
    { day: 'Wed', visitors: 31, approved: 27, rejected: 4 },
    { day: 'Thu', visitors: 19, approved: 17, rejected: 2 },
    { day: 'Fri', visitors: 26, approved: 22, rejected: 4 },
    { day: 'Sat', visitors: 18, approved: 16, rejected: 2 },
    { day: 'Sun', visitors: 12, approved: 11, rejected: 1 },
  ],

  // Risk distribution
  riskDistribution: [
    { name: 'Low Risk', value: 78, color: '#10b981' },
    { name: 'Medium Risk', value: 15, color: '#f59e0b' },
    { name: 'High Risk', value: 7, color: '#ef4444' },
  ],

  // Top visited flats
  topFlats: [
    { flat: 'A-302', visits: 45 },
    { flat: 'B-105', visits: 38 },
    { flat: 'C-401', visits: 34 },
    { flat: 'D-502', visits: 29 },
    { flat: 'A-201', visits: 26 },
    { flat: 'B-301', visits: 22 },
    { flat: 'C-102', visits: 19 },
    { flat: 'D-403', visits: 16 },
    { flat: 'A-504', visits: 14 },
    { flat: 'B-202', visits: 11 },
  ],

  // Frequent unknown visitors
  frequentUnknown: [
    { name: 'Unknown Male', phone: '+919600000111', visits: 5, rejections: 3, trustScore: 22 },
    { name: 'Suspicious Person', phone: '+919333222111', visits: 4, rejections: 4, trustScore: 15 },
    { name: 'Ravi (Self-ID)', phone: '+919400000222', visits: 3, rejections: 1, trustScore: 38 },
    { name: 'Unnamed Visitor', phone: '+919500000333', visits: 3, rejections: 2, trustScore: 28 },
    { name: 'Daily Wage Worker', phone: '+919700000444', visits: 6, rejections: 0, trustScore: 45 },
  ],

  // Guard activity
  guardActivity: [
    { guard: 'Rajesh Kumar', gate: 'Main Gate', entriesLogged: 18, shift: 'Morning', status: 'active' },
    { guard: 'Sunil Yadav', gate: 'Side Gate', entriesLogged: 6, shift: 'Morning', status: 'active' },
    { guard: 'Mohan Lal', gate: 'Main Gate', entriesLogged: 0, shift: 'Night', status: 'off-duty' },
    { guard: 'Deepak Sharma', gate: 'Parking Gate', entriesLogged: 0, shift: 'Night', status: 'off-duty' },
  ],

  // Heatmap data (7 days x 24 hours)
  heatmapData: (() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const data = []
    days.forEach((day, di) => {
      for (let h = 0; h < 24; h++) {
        let intensity = 0
        if (h >= 7 && h <= 10) intensity = Math.floor(Math.random() * 8 + 5)
        else if (h >= 11 && h <= 14) intensity = Math.floor(Math.random() * 6 + 3)
        else if (h >= 15 && h <= 19) intensity = Math.floor(Math.random() * 7 + 4)
        else if (h >= 20 && h <= 22) intensity = Math.floor(Math.random() * 4 + 1)
        else intensity = Math.floor(Math.random() * 2)
        if (di >= 5) intensity = Math.max(0, intensity - 2)
        data.push({ day, hour: h, value: intensity })
      }
    })
    return data
  })(),
}

// Helper functions
export const formatTime = (isoString) => {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export const formatDate = (isoString) => {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const formatDateTime = (isoString) => {
  if (!isoString) return '—'
  return `${formatDate(isoString)}, ${formatTime(isoString)}`
}

export const getTimeAgo = (isoString) => {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export const getStatusColor = (status) => {
  switch (status) {
    case 'pending': return 'badge-warning'
    case 'approved': return 'badge-info'
    case 'rejected': return 'badge-danger'
    case 'checked_in': return 'badge-success'
    case 'checked_out': return 'badge-neutral'
    case 'entered': return 'badge-success'
    case 'exited': return 'badge-neutral'
    default: return 'badge-neutral'
  }
}

export const getStatusLabel = (status) => {
  switch (status) {
    case 'pending': return 'Pending'
    case 'approved': return 'Approved'
    case 'rejected': return 'Rejected'
    case 'checked_in': return 'Inside'
    case 'checked_out': return 'Exited'
    case 'entered': return 'Inside'
    case 'exited': return 'Exited'
    default: return status
  }
}

export const getRiskBadge = (level) => {
  switch (level) {
    case 'Low': return 'badge-success'
    case 'Medium': return 'badge-warning'
    case 'High': return 'badge-danger'
    default: return 'badge-neutral'
  }
}

export const getTrustColor = (score) => {
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}
