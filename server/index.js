const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const { Readable } = require('stream');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer — in-memory only, no disk writes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Lazy Groq client
let groqClient = null;
function getGroq() {
  if (!groqClient) {
    const { Groq } = require('groq-sdk');
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

// ─────────────────────────────────────── HEALTH
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'SecureGate API' });
});

// ─────────────────────────────────────── TRANSLATE
// POST /api/chat/translate
// Body: { text: string, targetLang: 'en' | 'hi' | 'mr' }
app.post('/api/chat/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text || !targetLang) return res.status(400).json({ error: 'text and targetLang required' });

  const langMap = {
    en: 'English',
    hi: 'Hindi (Devanagari script — use हिंदी characters)',
    mr: 'Marathi (Devanagari script — use मराठी characters)'
  };
  const langName = langMap[targetLang];
  if (!langName) return res.status(400).json({ error: 'targetLang must be en, hi, or mr' });

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a natural conversational translator for a security guard and resident chat app in India.
Translate the given text to ${langName}.
CRITICAL RULES:
- Your response MUST be in the actual script of the target language (Devanagari for Hindi/Marathi)
- For Hindi: write in हिंदी script (e.g. "नमस्ते", "आइए", "ठीक है")
- For Marathi: write in मराठी script (e.g. "नमस्कार", "या", "बरे आहे")
- Keep casual and conversational tone — do NOT make it sound formal or bureaucratic
- Preserve names, flat numbers, phone numbers exactly as-is (do not translate them)
- If a word is universally known in English (Hi, OK, Yes, No, Sorry), you may keep it or give the natural local equivalent
- If the text is already in the target language, return it unchanged
- Return ONLY the translated text. No explanations, no quotes, no extra words.`
        },
        { role: 'user', content: text }
      ],
      temperature: 0.2,
      max_tokens: 500
    });
    const translated = completion.choices[0]?.message?.content?.trim() || text;
    res.json({ translated, original: text, targetLang });
  } catch (err) {
    console.error('Translation error:', err.message);
    res.status(500).json({ error: 'Translation failed', details: err.message });
  }
});

// ─────────────────────────────────────── TRANSCRIBE (no disk writes)
// NOTE: Chat now uses Web Speech API (no server calls needed)
// This endpoint is kept as a fallback only
app.post('/api/chat/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

  try {
    const groq = getGroq();

    // Convert buffer to a Readable stream — no temp files needed
    const audioStream = Readable.from(req.file.buffer);
    audioStream.path = `audio.${req.file.originalname?.split('.').pop() || 'webm'}`;

    const transcription = await groq.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-large-v3-turbo',
      response_format: 'json'
    });

    res.json({ text: transcription.text });
  } catch (err) {
    console.error('Transcription error:', err.message);
    res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

// ─────────────────────────────────────── SOCKET.IO
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join:room', (room) => {
    socket.join(room);
    console.log(`${socket.id} joined room: ${room}`);
  });

  socket.on('visitor:approve', (data) => {
    io.to(`guard:${data.gate}`).emit('visitor:approved', data);
  });

  socket.on('visitor:reject', (data) => {
    io.to(`guard:${data.gate}`).emit('visitor:rejected', data);
  });

  socket.on('chat:message', (data) => {
    io.to(`visit:${data.visitorId}`).emit('chat:message', data);
  });

  socket.on('emergency:alert', (data) => {
    io.emit('emergency:alert', data);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SecureGate API running on port ${PORT}`);
});
