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
const { Expo } = require('expo-server-sdk');

const STATIC_ROOT = path.resolve(__dirname, '..', 'static-build');
const TEMPLATE_PATH = path.resolve(__dirname, 'templates', 'landing-page.html');
const basePath = (process.env.BASE_PATH || '/').replace(/\/+$/, '');
const pagesOrigin = (process.env.PAGES_ORIGIN || '').trim();
const authCorsHeaders = {
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  ...(pagesOrigin ? { 'access-control-allow-origin': pagesOrigin } : {}),
};

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

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || '/';
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
    res.writeHead(204, authCorsHeaders);
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
          res.writeHead(500, { 'content-type': 'application/json', ...authCorsHeaders });
          res.end(JSON.stringify({ error: 'Server authentication not configured.' }));
          return;
        }

        // Only allow the two configured users.
        const allowed = { tommy: { envPass: process.env.TOMMY_PASSWORD, uid: process.env.TOMMY_UID }, jerry: { envPass: process.env.JERRY_PASSWORD, uid: process.env.JERRY_UID } };
        const entry = allowed[username];
        if (username === 'jerry' && (!entry?.envPass || !entry?.uid)) {
          res.writeHead(500, { 'content-type': 'application/json', ...authCorsHeaders });
          res.end(JSON.stringify({ error: 'The jerry account is not configured on the server.' }));
          return;
        }
        if (!entry || !entry.envPass || !entry.uid) {
          res.writeHead(401, { 'content-type': 'application/json', ...authCorsHeaders });
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
          res.writeHead(401, { 'content-type': 'application/json', ...authCorsHeaders });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        // Create a Firebase custom token for the mapped UID. Do NOT include
        // the password or other secrets in the token payload or logs.
        const token = await admin.auth().createCustomToken(entry.uid, { username });
        res.writeHead(200, { 'content-type': 'application/json', ...authCorsHeaders });
        res.end(JSON.stringify({ token }));
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json', ...authCorsHeaders });
        res.end(JSON.stringify({ error: 'Authentication error' }));
      }
    });
    return;
  }

  // Authenticated best-effort push endpoint. The client sends only the
  // Firestore message ID; this server reads the message and push tokens.
  if (pathname === '/notifications/chat-message' && req.method === 'OPTIONS') {
    res.writeHead(204, authCorsHeaders);
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
        res.writeHead(status, { 'content-type': 'application/json', ...authCorsHeaders });
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
