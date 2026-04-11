import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, User, Shield, Mic, MicOff, Languages, ChevronDown, Loader2 } from 'lucide-react'
import { db } from '../firebase'
import { doc, onSnapshot, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore'
import { getTimeAgo } from '../data/mockData'
import { notifyChatMessage } from '../utils/notificationHelpers'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

const DISPLAY_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
]

// Voice input language options for Web Speech API
const VOICE_LANGUAGES = [
  { code: 'en-IN', label: 'English (IN)' },
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'mr-IN', label: 'मराठी' },
]

// Check browser support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

// ── Groq translation ──────────────────────────────────────
async function translateText(text, targetLang) {
  try {
    const res = await fetch(`${SERVER_URL}/api/chat/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang })
    })
    const data = await res.json()
    return data.translated || text
  } catch { return text }
}

export default function VisitorChatModal({ visitorId, visitorName, visitorFlat, user, onClose }) {
  const [visitorDoc, setVisitorDoc] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [resolvedResidentName, setResolvedResidentName] = useState(null)

  // Translation
  const [displayLang, setDisplayLang] = useState('en')
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [translatingIds, setTranslatingIds] = useState(new Set())
  const [translationCache, setTranslationCache] = useState({})

  // Live speech-to-text
  const [isListening, setIsListening] = useState(false)
  const [voiceLang, setVoiceLang] = useState('en-IN')
  const [showVoiceLangMenu, setShowVoiceLangMenu] = useState(false)
  const [interimText, setInterimText] = useState('') // live partial text
  const recognitionRef = useRef(null)

  const chatBottomRef = useRef(null)
  const inputRef = useRef(null)
  const langMenuRef = useRef(null)
  const voiceLangMenuRef = useRef(null)

  // ── Firestore listener ──────────────────────────────────
  useEffect(() => {
    if (!visitorId) return
    const unsub = onSnapshot(doc(db, 'visitors', visitorId), snap => {
      if (snap.exists()) {
        const data = snap.data()
        setVisitorDoc(data)
        setMessages(data.messages || [])
        if (data.status === 'exited') onClose()
      }
    })
    return () => unsub()
  }, [visitorId, onClose])

  // ── Resident name lookup for guard ──────────────────────
  useEffect(() => {
    if (user.role !== 'guard' || !visitorFlat || !user.societyName) return
    if (visitorDoc?.residentName) { setResolvedResidentName(visitorDoc.residentName); return }
    const fetch_ = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('societyName', '==', user.societyName),
          where('flatGate', '==', visitorFlat),
          where('role', '==', 'resident')
        )
        const snap = await getDocs(q)
        if (!snap.empty) {
          const d = snap.docs[0].data()
          setResolvedResidentName(d.name || d.displayName || 'Resident')
        }
      } catch (e) { console.error(e) }
    }
    fetch_()
  }, [user, visitorFlat, visitorDoc])

  // ── Auto scroll ─────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Close menus on outside click ────────────────────────
  useEffect(() => {
    const h = e => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) setShowLangMenu(false)
      if (voiceLangMenuRef.current && !voiceLangMenuRef.current.contains(e.target)) setShowVoiceLangMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── Cleanup recognition on unmount ──────────────────────
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      }
    }
  }, [])

  // ── Translate messages when lang changes ─────────────────
  const ensureTranslation = useCallback(async (msg) => {
    if (displayLang === 'en') return
    const key = `${msg.id}_${displayLang}`
    if (translationCache[key]) return
    setTranslatingIds(prev => new Set(prev).add(msg.id))
    const translated = await translateText(msg.text, displayLang)
    setTranslationCache(prev => ({ ...prev, [key]: translated }))
    setTranslatingIds(prev => { const s = new Set(prev); s.delete(msg.id); return s })
  }, [displayLang, translationCache])

  useEffect(() => {
    if (displayLang === 'en' || messages.length === 0) return
    messages.forEach(msg => ensureTranslation(msg))
  }, [displayLang, messages, ensureTranslation])

  // ── Live Speech-to-Text toggle ───────────────────────────
  const toggleListening = () => {
    if (!SpeechRecognition) {
      alert('Your browser does not support voice input. Please use Chrome or Edge.')
      return
    }

    if (isListening) {
      // Stop
      recognitionRef.current?.stop()
      setIsListening(false)
      setInterimText('')
      return
    }

    // Start
    const recognition = new SpeechRecognition()
    recognition.continuous = true          // keep listening until stopped
    recognition.interimResults = true      // show partial results live
    recognition.lang = voiceLang           // en-IN / hi-IN / mr-IN
    recognition.maxAlternatives = 3        // pick best of 3 alternatives

    recognition.onstart = () => {
      setIsListening(true)
      setInterimText('')
    }

    recognition.onresult = (event) => {
      let interim = ''
      let finalText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += transcript
        } else {
          interim += transcript
        }
      }

      // Update live preview
      setInterimText(interim)

      // Append finalized text to input
      if (finalText) {
        setNewMessage(prev => {
          const base = prev.trimEnd()
          return base ? base + ' ' + finalText.trim() : finalText.trim()
        })
        setInterimText('')
      }
    }

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') {
        alert('Microphone permission denied. Please allow mic access in your browser settings.')
      } else if (e.error !== 'no-speech') {
        console.error('Speech error:', e.error)
      }
      setIsListening(false)
      setInterimText('')
    }

    recognition.onend = () => {
      // Auto-restart if still in listening mode (handles browser stopping after silence)
      if (recognitionRef.current && isListening) {
        try { recognitionRef.current.start() } catch (_) {}
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  // Keep isListening in onend closure up to date
  useEffect(() => {
    if (!recognitionRef.current) return
    recognitionRef.current.onend = () => {
      if (isListening) {
        try { recognitionRef.current?.start() } catch (_) {}
      } else {
        setInterimText('')
      }
    }
  }, [isListening])

  // ── Send message ─────────────────────────────────────────
  const handleSend = async (e) => {
    e?.preventDefault()
    const text = (newMessage + (interimText ? ' ' + interimText : '')).trim()
    if (!text || sending) return

    // Stop mic on send
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    }
    setInterimText('')

    setSending(true)
    try {
      await updateDoc(doc(db, 'visitors', visitorId), {
        messages: arrayUnion({
          id: Date.now().toString(),
          senderName: user.name || 'User',
          senderRole: user.role,
          text: text,
          timestamp: new Date().toISOString()
        })
      })
      setNewMessage('')

      // Notify the other party (fire-and-forget)
      if (visitorDoc?.societyName) {
        if (user.role === 'guard') {
          // Guard sent → notify the resident of that flat (helper looks up UID by flat)
          notifyChatMessage({
            societyName: visitorDoc.societyName,
            fromRole: 'guard',
            fromName: user.name,
            fromFlat: null,
            toFlat: visitorFlat,
            toUserId: null,
            messagePreview: text,
            visitorId,
          }).catch(console.error)
        } else {
          // Resident sent → notify the guard by their UID
          if (visitorDoc?.enteredBy) {
            notifyChatMessage({
              societyName: visitorDoc.societyName,
              fromRole: 'resident',
              fromName: user.name,
              fromFlat: user.flatGate || user.flat || visitorFlat,
              toUserId: visitorDoc.enteredBy,
              toFlat: null,
              messagePreview: text,
              visitorId,
            }).catch(console.error)
          }
        }
      }
    } catch (err) { console.error(err) }
    finally { setSending(false) }
  }

  // ── Display values ────────────────────────────────────────
  const residentDisplayName = resolvedResidentName || visitorDoc?.residentName || 'Resident'
  const guardDisplayName = visitorDoc?.guardName || 'Security Guard'
  const currentDisplayLang = DISPLAY_LANGUAGES.find(l => l.code === displayLang)?.label || 'English'
  const currentVoiceLang = VOICE_LANGUAGES.find(l => l.code === voiceLang)?.label || 'English (IN)'

  const modalContent = (
    <div className="fixed inset-0 z-[1000] bg-black/85 flex justify-center items-end sm:items-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-md h-[85vh] sm:h-[620px] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/70 overflow-hidden">

        {/* ── Header ───────────────────────────────────── */}
        <div className="flex items-start gap-2 justify-between px-4 py-3 border-b border-slate-700/80 bg-slate-800/90">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white mb-0.5">Visitor Chat</h3>
            {user.role === 'guard' ? (
              <p className="text-[11px] text-slate-400">Visitor: <span className="text-white font-medium">{visitorName || 'Visitor'}</span></p>
            ) : (
              <p className="text-[11px] text-slate-400">Chatting with: <span className="text-indigo-400 font-semibold">{guardDisplayName}</span></p>
            )}
          </div>
          {user.role === 'guard' && visitorFlat && (
            <div className="text-right shrink-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Flat {visitorFlat}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">{residentDisplayName}</p>
            </div>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-red-400 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Language Bar ─────────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/40 gap-2">
          {/* Display language */}
          <div className="flex items-center gap-1.5">
            <Languages className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500">View:</span>
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setShowLangMenu(v => !v)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 text-[11px] font-medium hover:bg-slate-700 border border-slate-600/50"
              >
                {currentDisplayLang}
                <ChevronDown className={`w-2.5 h-2.5 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
              </button>
              {showLangMenu && (
                <div className="absolute left-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-20 w-32">
                  {DISPLAY_LANGUAGES.map(lang => (
                    <button key={lang.code} onClick={() => { setDisplayLang(lang.code); setShowLangMenu(false) }}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-slate-700 ${displayLang === lang.code ? 'text-indigo-400 font-semibold' : 'text-slate-300'}`}>
                      {lang.label}
                      {displayLang === lang.code && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Voice input language */}
          <div className="flex items-center gap-1.5">
            <Mic className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500">Voice:</span>
            <div className="relative" ref={voiceLangMenuRef}>
              <button
                onClick={() => setShowVoiceLangMenu(v => !v)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 text-[11px] font-medium hover:bg-slate-700 border border-slate-600/50"
              >
                {currentVoiceLang}
                <ChevronDown className={`w-2.5 h-2.5 transition-transform ${showVoiceLangMenu ? 'rotate-180' : ''}`} />
              </button>
              {showVoiceLangMenu && (
                <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-20 w-36">
                  {VOICE_LANGUAGES.map(lang => (
                    <button key={lang.code} onClick={() => {
                      setVoiceLang(lang.code)
                      setShowVoiceLangMenu(false)
                      // Restart recognition with new language if active
                      if (isListening) {
                        recognitionRef.current?.stop()
                        setTimeout(() => toggleListening(), 200)
                      }
                    }}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-slate-700 ${voiceLang === lang.code ? 'text-indigo-400 font-semibold' : 'text-slate-300'}`}>
                      {lang.label}
                      {voiceLang === lang.code && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Messages ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-950/60">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Shield className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-slate-500 text-sm">No messages yet</p>
            </div>
          ) : messages.map(msg => {
            const isMe = msg.senderRole === user.role
            const key = `${msg.id}_${displayLang}`
            const displayText = displayLang === 'en' ? msg.text : (translationCache[key] || msg.text)
            const isTrans = translatingIds.has(msg.id)

            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-1.5">
                    {msg.senderRole === 'guard' ? <Shield className="w-3 h-3 text-cyan-400" /> : <User className="w-3 h-3 text-indigo-400" />}
                  </div>
                )}
                <div className={`max-w-[76%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <span className="text-[10px] text-slate-500 ml-1 mb-0.5">{msg.senderName} · {msg.senderRole === 'guard' ? 'Guard' : 'Resident'}</span>}
                  <div className={`rounded-2xl px-3 py-2 ${isMe ? 'bg-indigo-600 rounded-br-sm' : 'bg-slate-800 border border-slate-700/60 rounded-bl-sm'}`}>
                    <p className="text-sm text-white break-words leading-relaxed">
                      {isTrans ? <span className="text-[11px] text-slate-400 italic">translating…</span> : displayText}
                    </p>
                    {!isMe && displayLang !== 'en' && !isTrans && translationCache[key] && translationCache[key] !== msg.text && (
                      <p className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-700/50">{msg.text}</p>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-600 px-1 mt-0.5">{getTimeAgo(msg.timestamp)}</span>
                </div>
              </div>
            )
          })}
          <div ref={chatBottomRef} />
        </div>

        {/* ── Input ────────────────────────────────────── */}
        <div className="p-3 bg-slate-800/90 border-t border-slate-700">
          
          {/* Live voice preview */}
          {isListening && (
            <div className="mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0 mt-1.5" />
              <p className="text-sm text-slate-300 leading-relaxed flex-1">
                {newMessage && <span className="text-white">{newMessage} </span>}
                {interimText ? (
                  <span className="text-slate-400 italic">{interimText}</span>
                ) : (
                  <span className="text-slate-500 text-xs">Listening… speak now</span>
                )}
              </p>
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-2 items-center">
            {/* Mic toggle */}
            <button
              type="button"
              onClick={toggleListening}
              disabled={!SpeechRecognition}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-30 ${
                isListening
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 ring-2 ring-red-500/30'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
              }`}
              title={isListening ? 'Stop listening' : `Start voice (${currentVoiceLang})`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={isListening ? (newMessage + (interimText ? ' ' + interimText : '')) : newMessage}
              onChange={e => !isListening && setNewMessage(e.target.value)}
              placeholder={isListening ? 'Speak now…' : 'Type a message…'}
              readOnly={isListening}
              className={`flex-1 border rounded-2xl px-4 py-2.5 text-sm text-white outline-none transition-colors ${
                isListening
                  ? 'bg-slate-900/50 border-red-500/30 placeholder:text-red-400/60 cursor-default'
                  : 'bg-slate-900 border-slate-700 placeholder:text-slate-500 focus:border-indigo-500'
              }`}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !isListening) handleSend(e) }}
            />

            <button
              type="submit"
              disabled={!(newMessage.trim() || interimText.trim()) || sending}
              className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:bg-slate-700 hover:bg-indigo-400 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
            </button>
          </form>

          {!SpeechRecognition && (
            <p className="text-[10px] text-amber-500/70 text-center mt-1.5">Voice input requires Chrome or Edge browser</p>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
