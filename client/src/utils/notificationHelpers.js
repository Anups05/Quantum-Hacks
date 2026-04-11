/**
 * Notifications Helper — Firestore `notifications` collection
 *
 * Every notification MUST have toUserId set to the exact UID of the recipient.
 * This avoids flat-format mismatches and makes queries simple and reliable.
 *
 * Schema:
 * {
 *   toUserId: string,       // UID of recipient — REQUIRED
 *   fromName: string,       // Display name of sender
 *   fromFlat: string|null,  // Sender flat (for guard-side grouping)
 *   societyName: string,
 *   type: 'visitor_entry' | 'chat_message' | 'visitor_approved' | 'visitor_rejected' | 'visitor_blocked',
 *   title: string,
 *   message: string,
 *   relatedId: string|null, // visitorId
 *   read: boolean,
 *   createdAt: ISO string,
 * }
 */
import { db } from '../firebase'
import {
  collection, addDoc, query, where, onSnapshot,
  updateDoc, doc, writeBatch, getDocs, limit, getDoc
} from 'firebase/firestore'

// ── Internal: find resident UID by flat ──────────────────────
async function findResidentUidByFlat(societyName, flatGate) {
  if (!societyName || !flatGate) return null

  // Fetch all users for the society
  const q = query(
    collection(db, 'users'),
    where('societyName', '==', societyName)
  )
  const snap = await getDocs(q)
  
  if (snap.empty) return null

  const target = String(flatGate).trim().toUpperCase().replace(/[\s-]/g, '')

  const match = snap.docs.find(d => {
    const data = d.data()
    // Ignore non-residents (or at least prioritize residents, but we'll just check flat)
    if (data.role && data.role.toLowerCase() !== 'resident') return false
    const docFlat = String(data.flatGate || data.flat || '').trim().toUpperCase().replace(/[\s-]/g, '')
    return docFlat === target
  })

  return match ? match.id : null
}

// ── Create a single notification ─────────────────────────────
export const createNotification = async ({
  toUserId,
  fromName,
  fromFlat = null,
  societyName,
  type,
  title,
  message,
  relatedId = null,
}) => {
  if (!toUserId) return // never create a notification without a recipient
  await addDoc(collection(db, 'notifications'), {
    toUserId,
    fromName: fromName || '',
    fromFlat,
    societyName,
    type,
    title,
    message,
    relatedId,
    read: false,
    createdAt: new Date().toISOString(),
  })
}

// ── Single subscription for any user (guard or resident) ────
export const subscribeToUserNotifications = (userId, callback) => {
  const q = query(
    collection(db, 'notifications'),
    where('toUserId', '==', userId),
    limit(60)
  )
  return onSnapshot(q, snap => {
    const notifs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    callback(notifs)
  })
}

// ── Mark one notification read ────────────────────────────────
export const markNotificationRead = async (notifId) => {
  await updateDoc(doc(db, 'notifications', notifId), { read: true })
}

// ── Mark all notifications for a user read ───────────────────
export const markAllNotificationsRead = async (userId) => {
  const q = query(
    collection(db, 'notifications'),
    where('toUserId', '==', userId),
    where('read', '==', false)
  )
  const snap = await getDocs(q)
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.update(d.ref, { read: true }))
  await batch.commit()
}

// ═══════════════════════════════════════════════════════════════
//  TRIGGER HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * [Guard → Resident] New visitor logged at gate
 * Called from logVisitorEntry
 */
export const notifyResidentNewVisitor = async ({
  societyName,
  toFlat,           // normalized uppercase flat like 'A302'
  visitorName,
  purpose,
  visitorId,
  guardName,
}) => {
  const residentUid = await findResidentUidByFlat(societyName, toFlat)
  if (!residentUid) return
  await createNotification({
    toUserId: residentUid,
    fromName: guardName || 'Guard',
    fromFlat: null,
    societyName,
    type: 'visitor_entry',
    title: `Visitor at Gate`,
    message: `${visitorName} wants to visit your flat (${purpose}). Logged by ${guardName || 'Guard'}.`,
    relatedId: visitorId,
  })
}

/**
 * [Resident → Guard] Resident approved a visitor
 */
export const notifyGuardVisitorApproved = async ({
  societyName,
  guardUid,
  visitorName,
  residentName,
  flatGate,
  visitorId,
}) => {
  if (!guardUid) return
  await createNotification({
    toUserId: guardUid,
    fromName: residentName,
    fromFlat: flatGate,
    societyName,
    type: 'visitor_approved',
    title: `✅ Approved — Flat ${flatGate}`,
    message: `${residentName} (${flatGate}) approved ${visitorName}. QR pass generated.`,
    relatedId: visitorId,
  })
}

/**
 * [Resident → Guard] Resident rejected a visitor
 */
export const notifyGuardVisitorRejected = async ({
  societyName,
  guardUid,
  visitorName,
  residentName,
  flatGate,
  visitorId,
}) => {
  if (!guardUid) return
  await createNotification({
    toUserId: guardUid,
    fromName: residentName,
    fromFlat: flatGate,
    societyName,
    type: 'visitor_rejected',
    title: `❌ Rejected — Flat ${flatGate}`,
    message: `${residentName} (${flatGate}) rejected ${visitorName}. Do not allow entry.`,
    relatedId: visitorId,
  })
}

/**
 * [Resident → Guard] Resident blocked a visitor
 */
export const notifyGuardVisitorBlocked = async ({
  societyName,
  guardUid,
  visitorName,
  residentName,
  flatGate,
  visitorId,
}) => {
  if (!guardUid) return
  await createNotification({
    toUserId: guardUid,
    fromName: residentName,
    fromFlat: flatGate,
    societyName,
    type: 'visitor_blocked',
    title: `🚫 Blocked — Flat ${flatGate}`,
    message: `${residentName} (${flatGate}) BLOCKED ${visitorName}. Deny all future entries from this person.`,
    relatedId: visitorId,
  })
}

/**
 * [Chat] Notify the other party of a new chat message
 * fromRole: 'guard' | 'resident'
 */
export const notifyChatMessage = async ({
  societyName,
  fromRole,           // who is sending
  fromName,           // sender's name
  fromFlat,           // sender's flat (for resident) or visitor's flat (for guard)
  toUserId,           // explicit recipient UID (guard's UID for resident→guard)
  toFlat,             // recipient's flat (for guard→resident lookup)
  messagePreview,
  visitorId,
}) => {
  let recipientUid = toUserId

  if (fromRole === 'guard') {
    // Guard → Resident: look up resident by toFlat
    if (!recipientUid && toFlat && societyName) {
      recipientUid = await findResidentUidByFlat(societyName, toFlat)
    }
    if (!recipientUid) return
    await createNotification({
      toUserId: recipientUid,
      fromName: fromName,
      fromFlat: null,
      societyName,
      type: 'chat_message',
      title: `💬 Message from Guard ${fromName}`,
      message: messagePreview.length > 80 ? messagePreview.substring(0, 80) + '…' : messagePreview,
      relatedId: visitorId,
    })
  } else {
    // Resident → Guard: toUserId is the guard's UID
    if (!recipientUid) return
    await createNotification({
      toUserId: recipientUid,
      fromName: fromName,
      fromFlat: fromFlat,
      societyName,
      type: 'chat_message',
      title: `💬 Message from Flat ${fromFlat} (${fromName})`,
      message: messagePreview.length > 80 ? messagePreview.substring(0, 80) + '…' : messagePreview,
      relatedId: visitorId,
    })
  }
}
