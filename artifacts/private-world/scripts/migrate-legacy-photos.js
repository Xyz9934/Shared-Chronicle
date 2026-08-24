const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const getEnv = (name, required = true) => {
  const value = process.env[name]?.trim();
  if (!value && required) throw new Error(`${name} is required.`);
  return value || '';
};

function initializeFirebase() {
  if (admin.apps.length) return;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccount)) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
  } else {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_KEY, or GOOGLE_APPLICATION_CREDENTIALS.');
  }
}

function parseOwnerMap() {
  const raw = getEnv('PRIVATE_WORLD_OWNER_MAP');
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('PRIVATE_WORLD_OWNER_MAP must be a JSON object mapping legacy uploader names to Firebase UIDs.');
  return parsed;
}

function timestampToIso(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

function ownerIdFor(data, ownerMap) {
  if (typeof data.ownerId === 'string' && data.ownerId.trim()) return data.ownerId.trim();
  const uploadedBy = typeof data.uploadedBy === 'string' ? data.uploadedBy.trim() : '';
  const mapped = uploadedBy ? ownerMap[uploadedBy] : undefined;
  return typeof mapped === 'string' && mapped.trim() ? mapped.trim() : null;
}

async function main() {
  initializeFirebase();
  const write = process.argv.includes('--write');
  const limitIndex = process.argv.indexOf('--limit');
  const requestedLimit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : Infinity;
  const limit = Number.isFinite(requestedLimit) ? Math.max(Math.trunc(requestedLimit), 1) : Infinity;
  const spaceId = getEnv('PRIVATE_WORLD_SPACE_ID');
  const ownerMap = parseOwnerMap();
  const supabaseUrl = getEnv('SUPABASE_URL', write);
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', write);
  const bucket = getEnv('SUPABASE_MEDIA_BUCKET', false) || 'private-world-media';
  const supabase = write ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
  const photos = await admin.firestore().collection('photos').get();
  let processed = 0;
  let skipped = 0;
  let migrated = 0;

  for (const document of photos.docs) {
    if (processed >= limit) break;
    const data = document.data();
    const ownerId = ownerIdFor(data, ownerMap);
    const sourceUrl = typeof data.url === 'string' ? data.url : '';
    if (!ownerId || !sourceUrl) {
      skipped += 1;
      console.warn(`Skipping ${document.id}: missing URL or explicit owner mapping.`);
      continue;
    }
    processed += 1;

    if (write) {
      const existing = await supabase.from('media').select('id').eq('space_id', spaceId).eq('owner_id', ownerId).eq('source_media_id', `firestore:${document.id}`).maybeSingle();
      if (existing.error) throw new Error(`Could not check ${document.id}: ${existing.error.message}`);
      if (existing.data) {
        console.log(`Already migrated ${document.id} -> ${existing.data.id}`);
        continue;
      }

      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error(`Could not download ${document.id}: HTTP ${response.status}`);
      const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
      const bytes = Buffer.from(await response.arrayBuffer());
      const mediaId = randomUUID();
      const storagePath = `${spaceId}/${ownerId}/photos/${mediaId}/original`;
      const upload = await supabase.storage.from(bucket).upload(storagePath, bytes, { contentType, upsert: false });
      if (upload.error) throw new Error(`Could not upload ${document.id}: ${upload.error.message}`);
      const insert = await supabase.from('media').insert({ id: mediaId, space_id: spaceId, owner_id: ownerId, source_media_id: `firestore:${document.id}`, media_type: 'photo', mime_type: contentType, filename: data.caption || document.id, file_size: bytes.length, created_at_source: timestampToIso(data.createdAt) || timestampToIso(data.date), storage_path: storagePath, status: 'completed', uploaded_at: new Date().toISOString() });
      if (insert.error) {
        await supabase.storage.from(bucket).remove([storagePath]);
        throw new Error(`Could not write metadata for ${document.id}: ${insert.error.message}`);
      }
      migrated += 1;
      console.log(`Migrated ${document.id} -> ${mediaId}`);
    } else {
      console.log(`[dry-run] ${document.id}: owner=${ownerId}, source=${sourceUrl}`);
      migrated += 1;
    }
  }

  console.log(`${write ? 'Migration' : 'Dry-run'} complete: inspected=${processed}, eligible=${migrated}, skipped=${skipped}.`);
  if (!write) console.log('No remote changes were made. Re-run with --write only after reviewing owner mappings and the dry-run output.');
}

main().catch((error) => {
  console.error(`Legacy photo migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
});
