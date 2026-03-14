/**
 * VozClara Dashboard Server
 * Per-user auth: phone → OTP via WhatsApp/Telegram → session cookie
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
// Internal VozClara business API for OTP delivery
const VOZCLARA_API = (process.env.VOZCLARA_API_URL || 'https://api.voz-clara.com').replace(/\/$/, '');

// Canonical tier limits — source of truth (overrides DB values which may be stale)
const TIER_LIMITS = {
  free:     { daily: 5,   monthly: 15,   audio: 15 },
  basic:    { daily: 20,  monthly: 120,  audio: 120 },
  pro:      { daily: 40,  monthly: 500,  audio: 500 },
  business: { daily: 100, monthly: 2000, audio: 2000 },
  // expert tier removed
};
// First 16 chars of VOZCLARA_MASTER_KEY — matches vozclara-business validation
const INTERNAL_SECRET = (process.env.VOZCLARA_MASTER_KEY || process.env.INTERNAL_SECRET || '').slice(0, 16);

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='));
  });
  return cookies;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };
  const ct = types[ext] || 'text/plain';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 50000) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function httpsPost(host, path, headers, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const opts = {
      hostname: host, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
      timeout: 15000,
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    req.write(body);
    req.end();
  });
}

// ── Supabase ──────────────────────────────────────────────────────────────────

async function supaFetch(path, method = 'GET', body = null, extraHeaders = {}) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: new URL(SUPABASE_URL).hostname,
      path: path,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...extraHeaders,
      },
      timeout: 15000,
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getSessionUser(token) {
  if (!token) return null;
  const r = await supaFetch(`/rest/v1/dashboard_sessions?token=eq.${token}&select=user_id,expires_at`);
  if (!Array.isArray(r.data) || !r.data.length) return null;
  const session = r.data[0];
  if (new Date(session.expires_at) < new Date()) return null;
  const ur = await supaFetch(`/rest/v1/vozclara_users?id=eq.${session.user_id}&select=*`);
  if (!Array.isArray(ur.data) || !ur.data.length) return null;
  return ur.data[0];
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── OTP delivery via vozclara-business API ────────────────────────────────────

async function sendOTPviaWhatsApp(phone, otp) {
  try {
    const r = await httpsPost(
      new URL(VOZCLARA_API).hostname,
      '/internal/send-otp',
      {},
      { phone, otp, secret: INTERNAL_SECRET }
    );
    return r.status === 200;
  } catch (e) {
    console.error('[OTP] WhatsApp delivery error:', e.message);
    return false;
  }
}

// ── Multilingual query expansion ──────────────────────────────────────────────

async function expandQueryMultilingual(question) {
  if (!GROQ_API_KEY) return [];
  try {
    const r = await httpsPost('api.groq.com', '/openai/v1/chat/completions',
      { 'Authorization': `Bearer ${GROQ_API_KEY}` },
      {
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Given this search query: "${question}"
Extract the key search terms and provide their equivalents in English, Spanish, French, and Portuguese.
Return ONLY a JSON array of strings. No explanation.
Example for "cat": ["cat","cats","gato","gatos","chat","felino"]
JSON array:`,
        }],
        temperature: 0.1,
        max_tokens: 150,
      }
    );
    if (r.status === 200) {
      const content = r.body?.choices?.[0]?.message?.content?.trim() || '[]';
      const match = content.match(/\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]).map(t => t.toLowerCase().trim()).filter(t => t.length > 1);
    }
  } catch (e) { console.warn('[expandQuery]', e.message); }
  return [];
}

async function groqAnswer(question, contextRows) {
  if (!GROQ_API_KEY) return null;
  const context = contextRows.map((r, i) =>
    `[${i + 1}] ${new Date(r.created_at).toLocaleDateString()} | ${r.language || ''}\n${r.transcription}`
  ).join('\n\n---\n\n');
  const prompt = `You are VozClara, an AI assistant helping a user recall their voice note transcriptions.
User asks: "${question}"
Transcriptions:
${context}
Answer concisely, cite sources using [1], [2], etc. Reply in the same language as the question.`;
  try {
    const r = await httpsPost('api.groq.com', '/openai/v1/chat/completions',
      { 'Authorization': `Bearer ${GROQ_API_KEY}` },
      { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 500 }
    );
    if (r.status === 200) return r.body?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) { console.warn('[Groq]', e.message); }
  return null;
}

function keywordScore(row, terms) {
  const text = ((row.transcription || '') + ' ' + (row.summary || '')).toLowerCase();
  return terms.reduce((score, t) => {
    const count = (text.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    return score + count;
  }, 0);
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['vc_session'];

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Static files ──
  const publicDir = path.join(__dirname, 'public');
  if (pathname === '/' || pathname === '') {
    sendFile(res, path.join(publicDir, 'index.html')); return;
  }
  if (pathname === '/login') {
    sendFile(res, path.join(publicDir, 'login.html')); return;
  }
  if (pathname === '/app' || pathname === '/dashboard') {
    sendFile(res, path.join(publicDir, 'app.html')); return;
  }

  // ── API: Request OTP ──
  if (pathname === '/api/request-otp' && req.method === 'POST') {
    const body = await parseBody(req);
    const phone = (body.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 8) { sendJson(res, 400, { error: 'Invalid phone number' }); return; }

    // Check user exists
    const ur = await supaFetch(`/rest/v1/vozclara_users?phone_number=eq.${phone}&select=id,display_name,tier`);
    if (!Array.isArray(ur.data) || !ur.data.length) {
      sendJson(res, 404, { error: 'Phone number not found. Make sure you have a VozClara account first.' });
      return;
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Invalidate old OTPs
    await supaFetch(`/rest/v1/dashboard_otps?phone_number=eq.${phone}&used=eq.false`, 'PATCH', { used: true });

    // Create new OTP
    await supaFetch('/rest/v1/dashboard_otps', 'POST', { phone_number: phone, otp, expires_at: expiresAt, used: false });

    // Send via WhatsApp
    const sent = await sendOTPviaWhatsApp(phone, otp);
    if (!sent) {
      // Fallback: log OTP for dev (remove in prod)
      console.log(`[OTP DEV] Phone: ${phone}, OTP: ${otp}`);
    }

    sendJson(res, 200, { ok: true, sent, message: sent ? 'OTP sent via WhatsApp' : 'OTP created (delivery issue — contact support)' });
    return;
  }

  // ── API: Verify OTP ──
  if (pathname === '/api/verify-otp' && req.method === 'POST') {
    const body = await parseBody(req);
    const phone = (body.phone || '').replace(/\D/g, '');
    const otp = (body.otp || '').trim();
    if (!phone || !otp) { sendJson(res, 400, { error: 'Missing phone or OTP' }); return; }

    const or = await supaFetch(`/rest/v1/dashboard_otps?phone_number=eq.${phone}&otp=eq.${otp}&used=eq.false&order=created_at.desc&limit=1`);
    if (!Array.isArray(or.data) || !or.data.length) {
      sendJson(res, 401, { error: 'Invalid or expired OTP' }); return;
    }
    const otpRow = or.data[0];
    if (new Date(otpRow.expires_at) < new Date()) {
      sendJson(res, 401, { error: 'OTP expired. Please request a new one.' }); return;
    }

    // Mark used
    await supaFetch(`/rest/v1/dashboard_otps?id=eq.${otpRow.id}`, 'PATCH', { used: true });

    // Get user
    const ur = await supaFetch(`/rest/v1/vozclara_users?phone_number=eq.${phone}&select=id`);
    if (!Array.isArray(ur.data) || !ur.data.length) { sendJson(res, 404, { error: 'User not found' }); return; }
    const userId = ur.data[0].id;

    // Create session (30 days)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supaFetch('/rest/v1/dashboard_sessions', 'POST', { token, user_id: userId, expires_at: expiresAt });

    res.setHeader('Set-Cookie', `vc_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);
    sendJson(res, 200, { ok: true });
    return;
  }

  // ── API: Me (profile + quota) ──
  if (pathname === '/api/me' && req.method === 'GET') {
    const user = await getSessionUser(sessionToken);
    if (!user) { sendJson(res, 401, { error: 'Not authenticated' }); return; }
    const tier = user.tier || 'free';
    const limits = TIER_LIMITS[tier];

    // Count real usage — ONLY vozclara_transcriptions (single source of truth, no double-counting)
    // All sources (chrome/telegram/whatsapp) save here. transcriptions table has duplicates → ignore.
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [vt_today, vt_month] = await Promise.all([
      supaFetch(`/rest/v1/vozclara_transcriptions?user_id=eq.${user.id}&created_at=gte.${todayStart.toISOString()}&select=id,audio_duration_minutes`),
      supaFetch(`/rest/v1/vozclara_transcriptions?user_id=eq.${user.id}&created_at=gte.${monthStart.toISOString()}&select=id,audio_duration_minutes`),
    ]);

    const vtTodayRows = Array.isArray(vt_today.data) ? vt_today.data : [];
    const vtMonthRows = Array.isArray(vt_month.data) ? vt_month.data : [];

    const daily_notes_used = vtTodayRows.length;
    const monthly_notes_used = vtMonthRows.length;
    const audio_minutes_used = Math.round(vtMonthRows.reduce((s, r) => s + (parseFloat(r.audio_duration_minutes) || 0), 0) * 10) / 10;

    sendJson(res, 200, {
      id: user.id,
      display_name: user.display_name || user.first_name || 'Usuario',
      phone_number: user.phone_number,
      tier,
      daily_notes_used,
      daily_notes_limit: limits.daily,
      monthly_notes_used,
      monthly_notes_limit: limits.daily * 30, // unified: same formula as Telegram bot
      audio_minutes_used,
      audio_minutes_limit: limits.audio,
      output_language: user.output_language || 'es',
    });
    return;
  }

  // ── API: Transcriptions ──
  if (pathname === '/api/transcriptions' && req.method === 'GET') {
    const user = await getSessionUser(sessionToken);
    if (!user) { sendJson(res, 401, { error: 'Not authenticated' }); return; }
    const limit = Math.min(parseInt(parsed.query.limit) || 50, 200);
    const offset = parseInt(parsed.query.offset) || 0;
    const q = (parsed.query.q || '').toLowerCase();

    // Fetch from both tables in parallel
    const [r1, r2] = await Promise.all([
      supaFetch(`/rest/v1/vozclara_transcriptions?user_id=eq.${user.id}&select=id,transcription,summary,language,audio_duration_minutes,duration_seconds,from_number,telegram_id,sender_name,chat_name,created_at&order=created_at.desc&limit=200`),
      supaFetch(`/rest/v1/transcriptions?user_id=eq.${user.id}&select=id,text,summary,language,duration_seconds,source,sender_name,chat_name,created_at&order=created_at.desc&limit=200`),
    ]);

    // Normalize vozclara_transcriptions rows
    const rows1 = (Array.isArray(r1.data) ? r1.data : [])
      .filter(r => r.transcription) // only rows WITH text
      .map(r => ({
        id: r.id,
        transcription: r.transcription,
        summary: r.summary,
        language: r.language,
        audio_duration_minutes: r.audio_duration_minutes,
        duration_seconds: r.duration_seconds,
        from_number: r.from_number,
        telegram_id: r.telegram_id,
        sender_name: r.sender_name || null,
        chat_name: r.chat_name || null,
        created_at: r.created_at,
      }));

    // Normalize transcriptions rows (WhatsApp/Chrome via unified table)
    const rows2 = (Array.isArray(r2.data) ? r2.data : [])
      .filter(r => r.text) // only rows WITH text
      .map(r => ({
        id: r.id,
        transcription: r.text,
        summary: r.summary,
        language: r.language,
        audio_duration_minutes: r.duration_seconds ? r.duration_seconds / 60 : null,
        duration_seconds: r.duration_seconds,
        from_number: r.source === 'whatsapp' ? (r.sender_name || 'WhatsApp') : null,
        telegram_id: r.source === 'telegram' ? 1 : null,
        created_at: r.created_at,
      }));

    // Merge + deduplicate by created_at proximity (same second = same record)
    const seen = new Set(rows1.map(r => r.created_at?.slice(0,19)));
    const merged = [...rows1];
    for (const r of rows2) {
      if (!seen.has(r.created_at?.slice(0,19))) {
        merged.push(r);
        seen.add(r.created_at?.slice(0,19));
      }
    }

    // Sort by date desc, apply offset+limit
    merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    let rows = merged.slice(offset, offset + limit);

    if (q) {
      rows = rows.filter(row =>
        (row.transcription || '').toLowerCase().includes(q) ||
        (row.summary || '').toLowerCase().includes(q)
      );
    }
    sendJson(res, 200, { transcriptions: rows, total: rows.length });
    return;
  }

  // ── API: AI Search ──
  if (pathname === '/api/ai-search' && req.method === 'POST') {
    const user = await getSessionUser(sessionToken);
    if (!user) { sendJson(res, 401, { error: 'Not authenticated' }); return; }
    const body = await parseBody(req);
    const question = (body.q || '').trim();
    if (!question) { sendJson(res, 400, { error: 'Missing q' }); return; }

    try {
      const expandedTerms = await expandQueryMultilingual(question);
      const baseTerms = question.toLowerCase().split(/\s+/).filter(t => t.length > 1);
      const terms = [...new Set([...baseTerms, ...expandedTerms])];

      const [allR, allR2] = await Promise.all([
        supaFetch(`/rest/v1/vozclara_transcriptions?user_id=eq.${user.id}&select=id,transcription,summary,language,audio_duration_minutes,created_at&order=created_at.desc&limit=300`),
        supaFetch(`/rest/v1/transcriptions?user_id=eq.${user.id}&select=id,text,summary,language,duration_seconds,created_at&order=created_at.desc&limit=300`),
      ]);
      const seen2 = new Set();
      const allRows = [
        ...(Array.isArray(allR.data) ? allR.data : []).filter(r => r.transcription).map(r => { seen2.add(r.created_at?.slice(0,19)); return r; }),
        ...(Array.isArray(allR2.data) ? allR2.data : []).filter(r => r.text && !seen2.has(r.created_at?.slice(0,19))).map(r => ({ ...r, transcription: r.text, audio_duration_minutes: r.duration_seconds ? r.duration_seconds/60 : null })),
      ];
      const scored = allRows
        .map(r => ({ ...r, _score: keywordScore(r, terms) }))
        .filter(r => r._score > 0)
        .sort((a, b) => b._score - a._score)
        .slice(0, 10);

      if (!scored.length) {
        sendJson(res, 200, { answer: 'No se encontraron transcripciones relevantes para tu búsqueda.', sources: [] }); return;
      }

      const answer = await groqAnswer(question, scored);
      sendJson(res, 200, {
        answer: answer || `Encontré ${scored.length} transcripción(es) relacionada(s).`,
        sources: scored.map(r => ({ id: r.id, text: (r.transcription || '').slice(0, 200), created_at: r.created_at, language: r.language })),
      });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // ── API: Translate ──
  if (pathname === '/api/translate' && req.method === 'POST') {
    const user = await getSessionUser(sessionToken);
    if (!user) { sendJson(res, 401, { error: 'Not authenticated' }); return; }
    const body = await parseBody(req);
    const { text, lang } = body;
    if (!text) { sendJson(res, 400, { error: 'Missing text' }); return; }
    const targetLang = lang || 'en';
    const langNames = { en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese', de: 'German', it: 'Italian', ar: 'Arabic' };
    const langLabel = langNames[targetLang] || targetLang;
    try {
      const r = await httpsPost('api.groq.com', '/openai/v1/chat/completions',
        { 'Authorization': `Bearer ${GROQ_API_KEY}` },
        { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: `Translate the following to ${langLabel}. Return only the translation, no explanations:\n\n${text}` }], temperature: 0.1, max_tokens: 1000 }
      );
      if (r.status === 200) {
        const translated = r.body?.choices?.[0]?.message?.content?.trim() || '';
        sendJson(res, 200, { translated });
      } else {
        sendJson(res, 500, { error: 'Translation failed' });
      }
    } catch (e) { sendJson(res, 500, { error: e.message }); }
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // PADDLE BILLING
  // ═══════════════════════════════════════════════════════════

  // ── Paddle: Webhook ──────────────────────────────────────
  if (pathname === '/api/paddle/webhook' && req.method === 'POST') {
    const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET || '';

    // Collect raw body for signature verification
    let rawBody = '';
    await new Promise((resolve, reject) => {
      req.on('data', chunk => rawBody += chunk.toString());
      req.on('end', resolve);
      req.on('error', reject);
    });

    // Verify Paddle HMAC-SHA256 signature
    const sigHeader = req.headers['paddle-signature'] || '';
    const tsMatch  = sigHeader.match(/ts=(\d+)/);
    const h1Match  = sigHeader.match(/h1=([a-f0-9]+)/);
    if (!tsMatch || !h1Match) { res.writeHead(400); res.end('Missing signature'); return; }

    const signedPayload = `${tsMatch[1]}:${rawBody}`;
    const expected = crypto.createHmac('sha256', PADDLE_WEBHOOK_SECRET)
      .update(signedPayload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(h1Match[1]))) {
      console.warn('[Paddle] Invalid webhook signature');
      res.writeHead(403); res.end('Invalid signature'); return;
    }

    let event;
    try { event = JSON.parse(rawBody); } catch(e) { res.writeHead(400); res.end('Bad JSON'); return; }

    const eventType = event.event_type || '';
    const data      = event.data || {};
    const customData = data.custom_data || {};
    const paddleCustomerId = data.customer_id || data.customer?.id || '';

    // Map Paddle price IDs → VozClara tiers
    const PRICE_TO_TIER = {
      [process.env.PADDLE_PRICE_BASIC]:    'basic',
      [process.env.PADDLE_PRICE_PRO]:      'pro',
      [process.env.PADDLE_PRICE_BUSINESS]: 'business',
    };

    const priceId  = data.items?.[0]?.price?.id || data.items?.[0]?.price_id || '';
    const newTier  = PRICE_TO_TIER[priceId] || null;
    const app      = customData.app || 'vozclara';

    try {
      switch (eventType) {
        case 'subscription.created':
        case 'subscription.updated': {
          if (!newTier || !paddleCustomerId) break;
          const field = app === 'retena' ? 'rt_tier' : 'vc_tier';
          await supaFetch(`/rest/v1/users?paddle_customer_id=eq.${paddleCustomerId}`, 'PATCH',
            { [field]: newTier });
          console.log(`[Paddle] ${eventType}: ${paddleCustomerId} → ${field}=${newTier}`);
          break;
        }
        case 'subscription.canceled': {
          if (!paddleCustomerId) break;
          const field = app === 'retena' ? 'rt_tier' : 'vc_tier';
          const fallback = app === 'retena' ? 'none' : 'free';
          await supaFetch(`/rest/v1/users?paddle_customer_id=eq.${paddleCustomerId}`, 'PATCH',
            { [field]: fallback });
          console.log(`[Paddle] subscription.canceled: ${paddleCustomerId} → ${field}=${fallback}`);
          break;
        }
        case 'transaction.completed': {
          // Log invoice
          const txId      = data.id || '';
          const amountCents = Math.round((parseFloat(data.details?.totals?.total || 0)) * 100);
          const currency  = data.currency_code || 'USD';
          // Look up user by paddle_customer_id
          const ur = await supaFetch(`/rest/v1/users?paddle_customer_id=eq.${paddleCustomerId}&select=id`);
          const userId = ur.body?.[0]?.id || null;
          if (txId) {
            await supaFetch('/rest/v1/invoices', 'POST', {
              user_id: userId,
              paddle_customer_id: paddleCustomerId,
              paddle_tx_id: txId,
              amount_cents: amountCents,
              currency,
              tier: newTier,
              app,
              status: 'completed',
            });
          }
          console.log(`[Paddle] transaction.completed: ${txId} ${currency} ${amountCents / 100}`);
          break;
        }
        default:
          console.log(`[Paddle] Unhandled event: ${eventType}`);
      }
    } catch (e) {
      console.error('[Paddle] Handler error:', e.message);
    }

    // Always 200 — Paddle retries on non-2xx
    sendJson(res, 200, { received: true });
    return;
  }

  // ── Paddle: Customer Portal ───────────────────────────────
  if (pathname === '/api/paddle/portal' && req.method === 'GET') {
    const PADDLE_API_KEY = process.env.PADDLE_API_KEY || '';
    const PADDLE_ENV     = process.env.PADDLE_ENV || 'sandbox';
    const paddleBase     = PADDLE_ENV === 'production'
      ? 'https://api.paddle.com'
      : 'https://sandbox-api.paddle.com';

    if (!user) { sendJson(res, 401, { error: 'Not authenticated' }); return; }
    if (!user.paddle_customer_id) {
      sendJson(res, 400, { error: 'No billing account linked' }); return;
    }

    try {
      const portalRes = await new Promise((resolve, reject) => {
        const body = JSON.stringify({ customer_id: user.paddle_customer_id });
        const opts = {
          hostname: paddleBase.replace('https://', ''),
          path: '/customers/portal-sessions',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PADDLE_API_KEY}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        };
        const r = https.request(opts, res => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
        });
        r.on('error', reject);
        r.write(body);
        r.end();
      });
      if (portalRes.status === 201 || portalRes.status === 200) {
        const url = portalRes.body?.data?.urls?.general?.overview || '';
        sendJson(res, 200, { url });
      } else {
        console.error('[Paddle] Portal error:', portalRes.body);
        sendJson(res, 502, { error: 'Could not generate portal session' });
      }
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // ── API: Logout ──
  if (pathname === '/api/logout' && req.method === 'POST') {
    if (sessionToken) {
      await supaFetch(`/rest/v1/dashboard_sessions?token=eq.${sessionToken}`, 'DELETE');
    }
    res.setHeader('Set-Cookie', 'vc_session=; Path=/; Max-Age=0');
    sendJson(res, 200, { ok: true });
    return;
  }

  // ── Fallback: static files ──
  const staticPath = path.join(publicDir, pathname);
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    sendFile(res, staticPath); return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log(`VozClara Dashboard running on port ${PORT}`));
