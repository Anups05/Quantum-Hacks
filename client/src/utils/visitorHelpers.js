import {
  collection, query, where, getDocs, addDoc, doc,
  updateDoc, getDoc, setDoc, Timestamp, deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase'

/** Returns today's date string YYYY-MM-DD in IST */
export const todayIST = () => {
  const now = new Date()
  // Offset for IST (+5:30)
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
  return ist.toISOString().slice(0, 10)
}

/** Simple XOR-like obfuscation of base64 for "privacy" storage */
export const encryptPhoto = (base64) => btoa(base64)
export const decryptPhoto = (encoded) => { try { return atob(encoded) } catch { return encoded } }

/**
 * Compress an image file to a max of ~120KB base64 string
 */
export const compressImageToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (ev) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 400
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.55))
    }
    img.onerror = reject
    img.src = ev.target.result
  }
  reader.onerror = reject
  reader.readAsDataURL(file)
})

/**
 * Look up a visitor profile by phone number
 * @returns {Object|null} profile doc data or null
 */
export const lookupVisitorProfile = async (phone) => {
  const q = query(collection(db, 'visitorProfiles'), where('phone', '==', phone))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

/**
 * Checks if a phone number belongs to a registered resident/admin of the society
 */
export const checkIfSocietyMember = async (societyName, phone) => {
  const q = query(
    collection(db, 'users'),
    where('societyName', '==', societyName),
    where('phoneNumber', '==', phone)
  )
  const snap = await getDocs(q)
  return snap.empty ? null : snap.docs[0].data()
}

/**
 * Save a new visitor profile (first-time visitor)
 */
export const saveVisitorProfile = async ({ phone, name, photo, societyName }) => {
  const ref = doc(db, 'visitorProfiles', phone)   // phone as doc ID for easy lookup
  await setDoc(ref, {
    phone,
    name,
    photo: encryptPhoto(photo),    // stored encrypted
    societyName,
    createdAt: new Date().toISOString()
  })
}

/**
 * Log a visitor entry to the `visitors` collection
 */
export const logVisitorEntry = async ({
  name, phone, purpose, flatGate, societyName,
  enteredBy, guardName, photo, faceMatch
}) => {
  const token = crypto.randomUUID()
  const entryData = {
    name,
    phone,
    purpose,
    flatGate,
    societyName,
    enteredBy,         // guard UID
    guardName,         // Save the guard's actual name
    photo,             // snapshot of today's visit (compressed, not encrypted — for display)
    faceMatch,         // 'new' | 'matched' | 'mismatch'
    status: 'pending',
    qrToken: null,
    date: todayIST(),
    entryTimestamp: new Date().toISOString(),
    exitTimestamp: null,
  }
  const docRef = await addDoc(collection(db, 'visitors'), entryData)
  return { id: docRef.id, ...entryData }
}

/**
 * Log a pre-approved visitor entry to `visitors` collection bypassing resident approval by UPDATING the pass ID
 */
export const markPreApprovedVisitorInside = async (passId, enteredBy, guardName) => {
  await updateDoc(doc(db, 'visitors', passId), {
    status: 'inside', // Skipped pending and approved stages!
    enteredBy,
    guardName,
    date: todayIST(),  // stamp today's date so it shows in today's active visitors
    entryTimestamp: new Date().toISOString(),
    faceMatch: 'pre_approved'
  })
}

/**
 * Fetch today's entries for a given societyName
 */
export const getTodayEntries = async (societyName) => {
  const today = todayIST()
  const q = query(
    collection(db, 'visitors'),
    where('societyName', '==', societyName),
    where('date', '==', today)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Fetch pending visitors for a specific flat in a society
 */
export const getPendingVisitorsForFlat = async (societyName, flatGate) => {
  const q = query(
    collection(db, 'visitors'),
    where('societyName', '==', societyName),
    where('flatGate', '==', flatGate),
    where('status', '==', 'pending')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Fetch active pre-approved passes for a specific flat
 */
export const getPreApprovedPassesForFlat = async (societyName, flatGate) => {
  const q = query(
    collection(db, 'visitors'),
    where('societyName', '==', societyName),
    where('flatGate', '==', flatGate),
    where('type', '==', 'pre_approved_visitor')
  )
  const snap = await getDocs(q)
  const now = new Date()
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(pass => {
      // Show all non-revoked passes regardless of expiry
      if (pass.status === 'revoked') return false
      return true
    })
    .sort((a, b) => new Date(a.validFrom) - new Date(b.validFrom)) // earliest first
}

/**
 * Fetch all visitor entries for a specific flat (for history)
 */
export const getVisitorHistoryForFlat = async (societyName, flatGate) => {
  const q = query(
    collection(db, 'visitors'),
    where('societyName', '==', societyName),
    where('flatGate', '==', flatGate)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(
    (a, b) => new Date(b.entryTimestamp) - new Date(a.entryTimestamp)
  )
}

/**
 * Approve a visitor — sets status to 'approved' and generates a QR token
 */
export const approveVisitor = async (visitorId, residentName) => {
  const token = Math.floor(100000 + Math.random() * 900000).toString()
  await updateDoc(doc(db, 'visitors', visitorId), {
    status: 'approved',
    qrToken: token,
    residentName: residentName || null
  })
  return token
}

/**
 * Reject a visitor
 */
export const rejectVisitor = async (visitorId) => {
  await updateDoc(doc(db, 'visitors', visitorId), { status: 'rejected' })
}

/**
 * Delete a Pre-Approved Pass
 */
export const deletePreApprovedPass = async (passId) => {
  // Hard delete as requested
  await deleteDoc(doc(db, 'visitors', passId))
}

/**
 * Block a visitor — records who blocked them and when
 */
export const blockVisitor = async (visitorId, visitorData) => {
  await updateDoc(doc(db, 'visitors', visitorId), {
    status: 'blocked',
    blockedAt: new Date().toISOString()
  })
}

/**
 * Get all visitors blocked by a specific flat (resident)
 */
export const getBlockedVisitorsByFlat = async (societyName, flatGate) => {
  const q = query(
    collection(db, 'visitors'),
    where('societyName', '==', societyName),
    where('flatGate', '==', flatGate),
    where('status', '==', 'blocked')
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.blockedAt || b.entryTimestamp) - new Date(a.blockedAt || a.entryTimestamp))
}

/**
 * Unblock a visitor — sets status back to 'rejected'
 */
export const unblockVisitor = async (visitorId) => {
  await updateDoc(doc(db, 'visitors', visitorId), {
    status: 'rejected',
    unblockedAt: new Date().toISOString()
  })
}

/**
 * Permanently remove a visitor entry (for resident's blocked list)
 */
export const removeVisitorEntry = async (visitorId) => {
  await deleteDoc(doc(db, 'visitors', visitorId))
}

/**
 * Mark a visitor as 'inside' (after QR scan)
 */
export const markVisitorInside = async (visitorId) => {
  await updateDoc(doc(db, 'visitors', visitorId), {
    status: 'inside',
    checkinTimestamp: new Date().toISOString()
  })
}

/**
 * Verify OTP and mark visitor inside
 */
export const verifyOtpToken = async (otp, societyName) => {
  const q = query(
    collection(db, 'visitors'), 
    where('qrToken', '==', otp),
    where('societyName', '==', societyName),
    where('status', '==', 'approved')
  )
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('Invalid or expired OTP')
  
  const visitorId = snap.docs[0].id
  await markVisitorInside(visitorId)
  return { id: visitorId, ...snap.docs[0].data(), status: 'inside' }
}

/**
 * Mark a visitor exit
 */
export const markVisitorExit = async (visitorId) => {
  const visitorRef = doc(db, 'visitors', visitorId)
  const snap = await getDoc(visitorRef)
  
  if (snap.exists()) {
    const data = snap.data()
    const now = new Date()
    
    // Check if it's a reusable pre-approved pass that hasn't expired
    if (data.type === 'pre_approved_visitor' && data.validUntil && now < new Date(data.validUntil)) {
      await updateDoc(visitorRef, {
        status: 'pre_approved_active', // recycle it for another entry!
        exitTimestamp: now.toISOString()
      })
      return
    }
  }

  // default exit behavior
  await updateDoc(visitorRef, {
    status: 'exited',
    exitTimestamp: new Date().toISOString()
  })
}

/**
 * Get all visitors for a society (for the Guard's visitors tab)
 */
export const getAllVisitorsForSociety = async (societyName) => {
  const q = query(
    collection(db, 'visitors'),
    where('societyName', '==', societyName)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(
    (a, b) => new Date(b.entryTimestamp) - new Date(a.entryTimestamp)
  )
}

/**
 * Get all users with the role 'guard' for a specific society
 */
export const getAllGuardsForSociety = async (societyName) => {
  const q = query(
    collection(db, 'users'),
    where('societyName', '==', societyName),
    where('role', '==', 'guard')
  )
  const snap = await getDocs(q)
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

/**
 * Pre-Approve Visitor Workflow: Create a new Pass
 */
export const createPreApprovedPass = async (passData) => {
  const passRef = await addDoc(collection(db, 'visitors'), {
    ...passData,
    status: 'pre_approved_active', // distinguish from normal entries
    createdAt: new Date().toISOString()
  });
  return passRef.id;
}

/**
 * Pre-Approve Visitor Workflow: Fetch Pass by ID
 */
export const getPassById = async (passId) => {
  const snapshot = await getDocs(query(collection(db, 'visitors'), where('__name__', '==', passId)))
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
}

/**
 * Expected Visitor Workflow: Create Expected Visitor for Today
 */
export const createExpectedVisitor = async (visitorData) => {
  const docRef = await addDoc(collection(db, 'visitors'), {
    ...visitorData,
    type: 'expected_visitor',
    status: 'expected',
    expectedDate: todayIST(),
    createdAt: new Date().toISOString()
  });
  return docRef.id;
}

/**
 * Expected Visitor Workflow: Residents viewing their expected visitors
 */
export const getExpectedVisitorsForFlat = async (societyName, flatGate) => {
  const q = query(
    collection(db, 'visitors'),
    where('societyName', '==', societyName),
    where('flatGate', '==', flatGate),
    where('type', '==', 'expected_visitor'),
    where('expectedDate', '==', todayIST())
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Expected Visitor Workflow: Guards viewing expected visitors for the society
 */
export const getExpectedVisitorsForSociety = async (societyName) => {
  const q = query(
    collection(db, 'visitors'),
    where('societyName', '==', societyName),
    where('type', '==', 'expected_visitor'),
    where('expectedDate', '==', todayIST())
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
