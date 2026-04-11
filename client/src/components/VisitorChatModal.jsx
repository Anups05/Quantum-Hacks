import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, User, Shield } from 'lucide-react'
import { db } from '../firebase'
import { doc, onSnapshot, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore'
import { getTimeAgo } from '../data/mockData'

export default function VisitorChatModal({ visitorId, visitorName, visitorFlat, user, onClose }) {
  const [visitorDoc, setVisitorDoc] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  // For guard: the actual resident name fetched from users collection
  const [resolvedResidentName, setResolvedResidentName] = useState(null)
  const chatBottomRef = useRef(null)

  // Listen to visitor doc in real-time
  useEffect(() => {
    if (!visitorId) return
    const unsub = onSnapshot(doc(db, 'visitors', visitorId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setVisitorDoc(data)
        setMessages(data.messages || [])
        if (data.status === 'exited') onClose()
      }
    })
    return () => unsub()
  }, [visitorId, onClose])

  // Guard: look up the resident's real name from the flat number
  useEffect(() => {
    if (user.role !== 'guard' || !visitorFlat || !user.societyName) return

    // First check if the doc already has residentName (set on approve)
    if (visitorDoc?.residentName) {
      setResolvedResidentName(visitorDoc.residentName)
      return
    }

    // Otherwise query the users collection for the resident of this flat
    const fetchResident = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('societyName', '==', user.societyName),
          where('flatGate', '==', visitorFlat),
          where('role', '==', 'resident')
        )
        const snap = await getDocs(q)
        if (!snap.empty) {
          setResolvedResidentName(snap.docs[0].data().name || snap.docs[0].data().displayName || null)
        }
      } catch (e) {
        console.error('Could not fetch resident name:', e)
      }
    }
    fetchResident()
  }, [user, visitorFlat, visitorDoc])

  // Auto scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return
    setSending(true)
    try {
      await updateDoc(doc(db, 'visitors', visitorId), {
        messages: arrayUnion({
          id: Date.now().toString(),
          senderName: user.name || 'User',
          senderRole: user.role,
          text: newMessage.trim(),
          timestamp: new Date().toISOString()
        })
      })
      setNewMessage('')
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  // Guard sees the name of the resident for the flat
  const residentDisplayName = resolvedResidentName || visitorDoc?.residentName || 'Resident'

  // Resident sees the guard's name from the visitor document
  const guardDisplayName = visitorDoc?.guardName || 'Security Guard'

  const modalContent = (
    <div className="fixed inset-0 z-[1000] bg-black/80 flex justify-center items-end sm:items-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md h-[82vh] sm:h-[600px] flex flex-col rounded-t-3xl sm:rounded-2xl animate-fade-in relative overflow-hidden shadow-2xl shadow-black/60">

        {/* ── Header ── */}
        <div className="flex items-start justify-between p-4 border-b border-slate-700/80 bg-slate-800/90">
          <div className="flex-1">
            <h3 className="text-base font-bold text-white mb-0.5">Visitor Chat</h3>
            {user.role === 'guard' ? (
              <p className="text-xs text-slate-400">
                Visitor: <span className="text-white font-medium">{visitorName || 'Visitor'}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Chatting with: <span className="text-indigo-400 font-semibold">{guardDisplayName}</span>
              </p>
            )}
          </div>

          {/* Guard sees flat + resident name top-right */}
          {user.role === 'guard' && visitorFlat && (
            <div className="text-right mr-8 shrink-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Flat {visitorFlat}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {residentDisplayName}
              </p>
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Shield className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm font-medium">No messages yet</p>
              <p className="text-slate-600 text-xs">Start the conversation below</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderRole === user.role
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-1">
                      {msg.senderRole === 'guard'
                        ? <Shield className="w-3.5 h-3.5 text-cyan-400" />
                        : <User className="w-3.5 h-3.5 text-indigo-400" />
                      }
                    </div>
                  )}
                  <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                    {!isMe && (
                      <span className="text-[10px] text-slate-500 font-medium ml-1">
                        {msg.senderName} · {msg.senderRole === 'guard' ? 'Guard' : 'Resident'}
                      </span>
                    )}
                    <div className={`rounded-2xl px-3 py-2 ${
                      isMe
                        ? 'bg-indigo-600 rounded-br-sm text-white'
                        : 'bg-slate-800 border border-slate-700/80 rounded-bl-sm text-white'
                    }`}>
                      <p className="text-sm break-words leading-relaxed">{msg.text}</p>
                    </div>
                    <span className={`text-[9px] px-1 ${isMe ? 'text-slate-500 text-right' : 'text-slate-600'}`}>
                      {getTimeAgo(msg.timestamp)}
                    </span>
                  </div>
                </div>
              )
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="p-3 bg-slate-800/90 border-t border-slate-700">
          <form onSubmit={handleSend} className="flex gap-2 items-center">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 transition-colors"
              disabled={sending}
              autoFocus
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:bg-slate-700 hover:bg-indigo-400 transition-all active:scale-95 shadow-lg shadow-indigo-500/25"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
