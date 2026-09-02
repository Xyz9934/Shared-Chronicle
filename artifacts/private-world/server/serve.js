/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with two special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → landing page HTML
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Expo } = require('expo-server-sdk');
const webpush = require('web-push');

const STATIC_ROOT = path.resolve(__dirname, '..', 'static-build');
const TEMPLATE_PATH = path.resolve(__dirname, 'templates', 'landing-page.html');
const basePath = (process.env.BASE_PATH || '/').replace(/\/+$/, '');
const pagesOrigin = (process.env.PAGES_ORIGIN || '').trim();
const allowedAuthOrigins = new Set([
  'https://pvtwrld.site',
  'https://www.pvtwrld.site',
  ...(pagesOrigin ? [pagesOrigin] : []),
]);
const authCorsHeaders = {
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function getAuthCorsHeaders(req) {
  const origin = req.headers.origin;
  return allowedAuthOrigins.has(origin) ? { ...authCorsHeaders, 'access-control-allow-origin': origin, vary: 'Origin' } : authCorsHeaders;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, '..', 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    return typeof appJson.expo?.name === 'string'
      ? appJson.expo.name
      : 'App Landing Page';
  } catch {
    return 'App Landing Page';
  }
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toScriptString(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, 'utf-8');
  res.writeHead(200, {
    'content-type': 'application/json',
    'expo-protocol-version': '1',
    'expo-sfv-version': '0',
  });
  res.end(manifest);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers['host'];
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `exps://${host}${basePath}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_ATTRIBUTE_PLACEHOLDER/g, escapeHtml(expsUrl))
    .replace(/EXPS_URL_JSON_PLACEHOLDER/g, toScriptString(expsUrl))
    .replace(/APP_NAME_PLACEHOLDER/g, escapeHtml(appName));

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'content-type': contentType });
  res.end(content);
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
const appName = getAppName();
const expo = new Expo();
let webPushConfigured = false;
if (process.env.WEB_PUSH_VAPID_SUBJECT && process.env.WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(process.env.WEB_PUSH_VAPID_SUBJECT, process.env.WEB_PUSH_VAPID_PUBLIC_KEY, process.env.WEB_PUSH_VAPID_PRIVATE_KEY);
    webPushConfigured = true;
  } catch (error) {
    console.error('Web Push VAPID configuration is invalid', { error: error?.message || 'unknown' });
  }
}

// Lightweight auth endpoint to exchange a server-side username/password for a
// Firebase custom token. The server uses service account credentials provided
// via the FIREBASE_SERVICE_ACCOUNT_KEY environment variable (JSON string) or
// GOOGLE_APPLICATION_CREDENTIALS. The endpoint intentionally does not log
// sensitive values and only accepts the two allowed usernames.
let adminInitialized = false;
let admin;
try {
  // Lazy require so environments that do not use the server don't need the
  // dependency installed at runtime for static serving.
  admin = require('firebase-admin');
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    const parsed = JSON.parse(serviceAccount);
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
    adminInitialized = true;
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    adminInitialized = true;
  }
} catch (e) {
  // If firebase-admin is not available or initialization failed, the server
  // will continue to serve static files but authentication will be disabled.
  adminInitialized = false;
}

const MUSIC_BUCKET = 'private-world-media';
const MUSIC_MAX_BYTES = 100 * 1024 * 1024;
const MUSIC_EXTENSIONS = new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus']);
const MUSIC_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg', 'audio/opus', 'application/octet-stream']);
let musicSupabase;

function musicJson(res, status, payload, req) {
  res.writeHead(status, { 'content-type': 'application/json', ...getAuthCorsHeaders(req) });
  res.end(JSON.stringify(payload));
}

function readJson(req, maxBytes = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

function privateMusicService() {
  if (musicSupabase) return musicSupabase;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Private music storage is not configured.');
  }
  // Service role credentials never leave this server. All caller authorization
  // happens before a storage/database operation is made.
  const { createClient } = require('@supabase/supabase-js');
  musicSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return musicSupabase;
}

function cleanMusicText(value, limit) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, limit) : '';
}

function musicExtension(filename) {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match?.[1]?.toLowerCase() || '';
}

async function requirePrivateMusicMember(req) {
  if (!adminInitialized) throw Object.assign(new Error('Music service is not configured.'), { status: 503 });
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const decoded = await admin.auth().verifyIdToken(authorization.slice(7));
  const profile = await admin.firestore().collection('users').doc(decoded.uid).get();
  if (!profile.exists || !['OWNER', 'USER'].includes(profile.data()?.role)) throw Object.assign(new Error('Forbidden'), { status: 403 });
  const spaceId = (process.env.PRIVATE_WORLD_SPACE_ID || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(spaceId)) {
    throw Object.assign(new Error('Private music space is not configured.'), { status: 503 });
  }
  const supabase = privateMusicService();
  const { data: membership, error } = await supabase
    .from('space_members')
    .select('role')
    .eq('space_id', spaceId)
    .eq('user_id', decoded.uid)
    .maybeSingle();
  if (error) throw Object.assign(new Error('Could not verify music access.'), { status: 503 });
  if (!membership) throw Object.assign(new Error('You do not have access to this music library.'), { status: 403 });
  return { decoded, profile: profile.data(), spaceId, role: membership.role, supabase };
}

function mapMusicTrack(row, streamUrl) {
  return {
    id: row.id,
    provider: 'private',
    spaceId: row.space_id,
    uploadedById: row.uploaded_by,
    uploadedByName: row.uploaded_by_name || 'Private World member',
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    title: row.title,
    artist: row.artist || undefined,
    album: row.album || undefined,
    artworkUrl: row.artwork_path || undefined,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    durationMs: row.duration_ms == null ? undefined : Number(row.duration_ms),
    createdAt: row.created_at,
    ...(streamUrl ? { streamUrl } : {}),
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || '/';
  }

  if (pathname.startsWith('/api/music') && req.method === 'OPTIONS') {
    res.writeHead(204, getAuthCorsHeaders(req));
    res.end();
    return;
  }

  if (pathname === '/api/music' && req.method === 'GET') {
    void (async () => {
      try {
        const { supabase, spaceId } = await requirePrivateMusicMember(req);
        const { data, error } = await supabase.from('private_world_music').select('*').eq('space_id', spaceId).order('created_at', { ascending: false });
        if (error) throw Object.assign(new Error('Could not load the shared library.'), { status: 503 });
        const items = await Promise.all(data.map(async (row) => {
          const { data: signed, error: signedError } = await supabase.storage.from(MUSIC_BUCKET).createSignedUrl(row.storage_path, 10 * 60);
          return mapMusicTrack(row, signedError ? undefined : signed?.signedUrl);
        }));
        musicJson(res, 200, { items }, req);
      } catch (error) {
        musicJson(res, error?.status || 500, { error: error?.message || 'Music service error.' }, req);
      }
    })();
    return;
  }

  if (pathname === '/api/music/upload-ticket' && req.method === 'POST') {
    void (async () => {
      try {
        const { supabase, spaceId } = await requirePrivateMusicMember(req);
        const payload = await readJson(req);
        const filename = cleanMusicText(payload.filename, 180);
        const extension = musicExtension(filename);
        const mimeType = cleanMusicText(payload.mimeType, 100).toLowerCase();
        const fileSize = Number(payload.fileSize);
        if (!filename || !MUSIC_EXTENSIONS.has(extension) || !MUSIC_MIME_TYPES.has(mimeType)) throw Object.assign(new Error('Unsupported audio type.'), { status: 400 });
        if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > MUSIC_MAX_BYTES) throw Object.assign(new Error('Songs must be between 1 byte and 100 MB.'), { status: 400 });
        const id = crypto.randomUUID();
        const path = `spaces/${spaceId}/music/${id}.${extension}`;
        const { data, error } = await supabase.storage.from(MUSIC_BUCKET).createSignedUploadUrl(path, { upsert: false });
        if (error || !data?.token) throw Object.assign(new Error('Could not prepare the audio upload.'), { status: 503 });
        musicJson(res, 201, { id, path, token: data.token }, req);
      } catch (error) {
        musicJson(res, error?.status || 500, { error: error?.message || 'Could not prepare the upload.' }, req);
      }
    })();
    return;
  }

  if (pathname === '/api/music' && req.method === 'POST') {
    void (async () => {
      try {
        const { decoded, profile, supabase, spaceId } = await requirePrivateMusicMember(req);
        const payload = await readJson(req);
        const id = cleanMusicText(payload.id, 36);
        const filename = cleanMusicText(payload.filename, 180);
        const extension = cleanMusicText(payload.extension, 8).toLowerCase();
        const mimeType = cleanMusicText(payload.mimeType, 100).toLowerCase();
        const title = cleanMusicText(payload.title, 180);
        if (!/^[0-9a-f-]{36}$/i.test(id) || !title || extension !== musicExtension(filename) || !MUSIC_EXTENSIONS.has(extension) || !MUSIC_MIME_TYPES.has(mimeType)) {
          throw Object.assign(new Error('Invalid music metadata.'), { status: 400 });
        }
        const storagePath = `spaces/${spaceId}/music/${id}.${extension}`;
        const { data: objects, error: listError } = await supabase.storage.from(MUSIC_BUCKET).list(`spaces/${spaceId}/music`, { search: `${id}.` });
        const object = objects?.find((item) => item.name === `${id}.${extension}`);
        const actualSize = Number(object?.metadata?.size);
        const actualMime = typeof object?.metadata?.mimetype === 'string' ? object.metadata.mimetype.toLowerCase() : '';
        if (listError || !object || !Number.isFinite(actualSize) || actualSize < 1 || actualSize > MUSIC_MAX_BYTES || !MUSIC_MIME_TYPES.has(actualMime)) {
          throw Object.assign(new Error('Uploaded audio did not pass validation.'), { status: 400 });
        }
        const uploaderName = cleanMusicText(profile?.name, 100) || decoded.name || 'Private World member';
        const { data: row, error } = await supabase.from('private_world_music').insert({
          id,
          space_id: spaceId,
          uploaded_by: decoded.uid,
          uploaded_by_name: uploaderName,
          storage_path: storagePath,
          original_filename: filename,
          title,
          artist: cleanMusicText(payload.artist, 160) || null,
          album: cleanMusicText(payload.album, 160) || null,
          mime_type: actualMime,
          file_size: actualSize,
          duration_ms: Number.isFinite(Number(payload.durationMs)) && Number(payload.durationMs) >= 0 ? Math.floor(Number(payload.durationMs)) : null,
        }).select().single();
        if (error) throw Object.assign(new Error('Could not save music metadata.'), { status: 503 });
        const { data: signed } = await supabase.storage.from(MUSIC_BUCKET).createSignedUrl(storagePath, 10 * 60);
        musicJson(res, 201, { item: mapMusicTrack(row, signed?.signedUrl) }, req);
      } catch (error) {
        musicJson(res, error?.status || 500, { error: error?.message || 'Could not save this song.' }, req);
      }
    })();
    return;
  }

  const musicMatch = /^\/api\/music\/([0-9a-f-]{36})(?:\/(download-url))?$/i.exec(pathname);
  if (musicMatch && req.method === 'GET' && musicMatch[2] === 'download-url') {
    void (async () => {
      try {
        const { supabase, spaceId } = await requirePrivateMusicMember(req);
        const { data: row, error } = await supabase.from('private_world_music').select('storage_path').eq('id', musicMatch[1]).eq('space_id', spaceId).maybeSingle();
        if (error || !row) throw Object.assign(new Error('Song not found.'), { status: 404 });
        const { data: signed, error: signedError } = await supabase.storage.from(MUSIC_BUCKET).createSignedUrl(row.storage_path, 10 * 60);
        if (signedError || !signed?.signedUrl) throw Object.assign(new Error('Could not prepare the download.'), { status: 503 });
        musicJson(res, 200, { url: signed.signedUrl }, req);
      } catch (error) {
        musicJson(res, error?.status || 500, { error: error?.message || 'Could not prepare the download.' }, req);
      }
    })();
    return;
  }

  if (musicMatch && req.method === 'DELETE' && !musicMatch[2]) {
    void (async () => {
      try {
        const { decoded, role, supabase, spaceId } = await requirePrivateMusicMember(req);
        const { data: row, error } = await supabase.from('private_world_music').select('storage_path,uploaded_by').eq('id', musicMatch[1]).eq('space_id', spaceId).maybeSingle();
        if (error || !row) throw Object.assign(new Error('Song not found.'), { status: 404 });
        if (row.uploaded_by !== decoded.uid && role !== 'OWNER') throw Object.assign(new Error('Only the uploader or space owner can delete this song.'), { status: 403 });
        const { error: deleteError } = await supabase.from('private_world_music').delete().eq('id', musicMatch[1]).eq('space_id', spaceId);
        if (deleteError) throw Object.assign(new Error('Could not delete the song.'), { status: 503 });
        await supabase.storage.from(MUSIC_BUCKET).remove([row.storage_path]);
        musicJson(res, 200, { deleted: true }, req);
      } catch (error) {
        musicJson(res, error?.status || 500, { error: error?.message || 'Could not delete the song.' }, req);
      }
    })();
    return;
  }

  if (pathname === '/' || pathname === '/manifest') {
    const platform = req.headers['expo-platform'];
    if (platform === 'ios' || platform === 'android') {
      return serveManifest(platform, res);
    }

    if (pathname === '/') {
      return serveLandingPage(req, res, landingPageTemplate, appName);
    }
  }

  // Auth endpoint: POST /auth/login
  if (pathname === '/auth/login' && req.method === 'OPTIONS') {
    res.writeHead(204, getAuthCorsHeaders(req));
    res.end();
    return;
  }

  if (pathname === '/auth/login' && req.method === 'POST') {
    // Read JSON body
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const username = typeof payload.username === 'string' ? payload.username.toLowerCase().trim() : '';
        const password = typeof payload.password === 'string' ? payload.password : '';

        if (!adminInitialized) {
          res.writeHead(500, { 'content-type': 'application/json', ...getAuthCorsHeaders(req) });
          res.end(JSON.stringify({ error: 'Server authentication not configured.' }));
          return;
        }

        // Only allow the two configured users.
        const allowed = { tommy: { envPass: process.env.TOMMY_PASSWORD, uid: process.env.TOMMY_UID }, jerry: { envPass: process.env.JERRY_PASSWORD, uid: process.env.JERRY_UID } };
        const entry = allowed[username];
        if (username === 'jerry' && (!entry?.envPass || !entry?.uid)) {
          res.writeHead(500, { 'content-type': 'application/json', ...getAuthCorsHeaders(req) });
          res.end(JSON.stringify({ error: 'The jerry account is not configured on the server.' }));
          return;
        }
        if (!entry || !entry.envPass || !entry.uid) {
          res.writeHead(401, { 'content-type': 'application/json', ...getAuthCorsHeaders(req) });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        // Constant-time comparison to avoid leaking timing information.
        const crypto = require('crypto');
        const a = Buffer.from(String(password));
        const b = Buffer.from(String(entry.envPass));
        let ok = false;
        try {
          ok = a.length === b.length && crypto.timingSafeEqual(a, b);
        } catch (e) {
          ok = false;
        }

        if (!ok) {
          res.writeHead(401, { 'content-type': 'application/json', ...getAuthCorsHeaders(req) });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        // Create a Firebase custom token for the mapped UID. Do NOT include
        // the password or other secrets in the token payload or logs.
        const token = await admin.auth().createCustomToken(entry.uid, { username });
        res.writeHead(200, { 'content-type': 'application/json', ...getAuthCorsHeaders(req) });
        res.end(JSON.stringify({ token }));
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json', ...getAuthCorsHeaders(req) });
        res.end(JSON.stringify({ error: 'Authentication error' }));
      }
    });
    return;
  }

  // Authenticated best-effort push endpoint. The client sends only the
  // Firestore message ID; this server reads the message and push tokens.
  if (pathname === '/notifications/chat-message' && req.method === 'OPTIONS') {
    res.writeHead(204, getAuthCorsHeaders(req));
    res.end();
    return;
  }

  if (pathname === '/notifications/chat-message' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', async () => {
      const json = (status, payload) => {
        res.writeHead(status, { 'content-type': 'application/json', ...getAuthCorsHeaders(req) });
        res.end(JSON.stringify(payload));
      };

      try {
        if (!adminInitialized) return json(503, { error: 'Push notifications are not configured.' });
        const authorization = req.headers.authorization || '';
        if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' });
        const decoded = await admin.auth().verifyIdToken(authorization.slice(7));
        const payload = JSON.parse(body || '{}');
        const messageId = typeof payload.messageId === 'string' ? payload.messageId.trim() : '';
        if (!messageId || !/^[A-Za-z0-9_-]{1,150}$/.test(messageId)) return json(400, { error: 'Invalid message ID' });

        const messageRef = admin.firestore().collection('messages').doc(messageId);
        const messageSnapshot = await messageRef.get();
        if (!messageSnapshot.exists) return json(404, { error: 'Message not found' });
        const message = messageSnapshot.data();
        if (!message || message.senderId !== decoded.uid || typeof message.text !== 'string' || !message.text.trim()) return json(403, { error: 'Forbidden' });

        const claim = await admin.firestore().runTransaction(async (transaction) => {
          const current = await transaction.get(messageRef);
          const currentData = current.data() || {};
          if (currentData.pushNotificationStatus === 'sent' || currentData.pushNotificationStatus === 'sending') return false;
          transaction.update(messageRef, { pushNotificationStatus: 'sending' });
          return true;
        });
        if (!claim) return json(200, { sent: false, duplicate: true });

        const recipientId = typeof message.recipientId === 'string' && message.recipientId !== decoded.uid ? message.recipientId : '';
        const users = recipientId
          ? [await admin.firestore().collection('users').doc(recipientId).get()]
          : (await admin.firestore().collection('users').get()).docs.filter((profile) => profile.id !== decoded.uid);
        const recipients = users.filter((profile) => profile.exists && ['OWNER', 'USER'].includes(profile.data().role));
        const tokenOwners = new Map();
        recipients.forEach((profile) => {
          const data = profile.data();
          const values = Array.isArray(data.pushTokens) ? data.pushTokens : typeof data.pushToken === 'string' ? [data.pushToken] : [];
          values.filter((token) => typeof token === 'string' && Expo.isExpoPushToken(token)).forEach((token) => tokenOwners.set(token, profile));
        });
        const tokens = [...tokenOwners.keys()];
        const messages = tokens.map((to) => ({
          to,
          sound: 'default',
          title: `Message from ${message.senderName || 'your private world'}`,
          body: message.text.trim().slice(0, 180),
          data: { screen: 'chat', messageId },
          channelId: 'chat-messages',
        }));
        const invalidByUser = new Map();
        for (const chunk of expo.chunkPushNotifications(messages)) {
          try {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            tickets.forEach((ticket, index) => {
              if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                const token = chunk[index].to;
                const owner = tokenOwners.get(token);
                if (owner) invalidByUser.set(owner.id, [...(invalidByUser.get(owner.id) || []), token]);
              }
            });
          } catch (error) {
            console.error('Expo push notification batch failed', { error });
          }
        }
        await Promise.all([...invalidByUser.entries()].map(([uid, invalidTokens]) => {
          const update = { pushTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens) };
          const profile = recipients.find((candidate) => candidate.id === uid);
          if (invalidTokens.includes(profile?.data().pushToken)) update.pushToken = admin.firestore.FieldValue.delete();
          return admin.firestore().collection('users').doc(uid).update(update);
        }));
        const webSubscriptions = new Map();
        recipients.forEach((profile) => {
          const subscriptions = Array.isArray(profile.data().webPushSubscriptions) ? profile.data().webPushSubscriptions : [];
          subscriptions.forEach((subscription) => {
            if (subscription?.endpoint && subscription?.keys?.p256dh && subscription?.keys?.auth) webSubscriptions.set(subscription.endpoint, { owner: profile, subscription });
          });
        });
        const invalidWebByUser = new Map();
        if (webPushConfigured) {
          const webEntries = [...webSubscriptions.values()];
          for (let start = 0; start < webEntries.length; start += 50) {
            await Promise.all(webEntries.slice(start, start + 50).map(async ({ owner, subscription }) => {
              try {
                await webpush.sendNotification(subscription, JSON.stringify({
                  title: `Message from ${message.senderName || 'your private world'}`,
                  body: message.text.trim().slice(0, 180),
                  data: { screen: 'chat', messageId },
                }));
              } catch (error) {
                if (error?.statusCode === 404 || error?.statusCode === 410) {
                  invalidWebByUser.set(owner.id, [...(invalidWebByUser.get(owner.id) || []), subscription]);
                } else {
                  console.error('Web Push notification failed', { error: error?.message || 'unknown' });
                }
              }
            }));
          }
        }
        await Promise.all([...invalidWebByUser.entries()].map(([uid, invalidSubscriptions]) => admin.firestore().collection('users').doc(uid).update({ webPushSubscriptions: admin.firestore.FieldValue.arrayRemove(...invalidSubscriptions) })));
        await messageRef.update({ pushNotificationStatus: 'sent', pushNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() });
        return json(200, { sent: tokens.length > 0 });
      } catch (error) {
        console.error('Chat push notification request failed', { error: error?.code || error?.message || 'unknown' });
        return json(500, { error: 'Push notification request failed' });
      }
    });
    return;
  }

  serveStaticFile(pathname, res);
});

const port = parseInt(process.env.PORT || '3000', 10);
server.listen(port, '0.0.0.0', () => {
  console.log(`Serving static Expo build on port ${port}`);
});
