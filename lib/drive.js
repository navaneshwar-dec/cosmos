import sql from './db';

const TOKEN_URL   = 'https://oauth2.googleapis.com/token';
const API         = 'https://www.googleapis.com/drive/v3';
const UPLOAD      = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

// thrown when the user hasn't granted Drive access yet (no refresh token) or it was revoked
export class DriveNotConnected extends Error {
  constructor() { super('DRIVE_NOT_CONNECTED'); this.code = 'DRIVE_NOT_CONNECTED'; }
}

export async function isConnected(userId) {
  const [u] = await sql`SELECT google_refresh_token FROM users WHERE id = ${userId}`;
  return !!u?.google_refresh_token;
}

async function refreshAccessToken(user) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: user.google_refresh_token,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new DriveNotConnected();   // refresh token revoked/expired → force reconnect
  const data = await res.json();
  const expiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await sql`UPDATE users SET google_access_token = ${data.access_token}, google_token_expiry = ${expiry} WHERE id = ${user.id}`;
  return data.access_token;
}

async function accessTokenFor(userId) {
  const [user] = await sql`
    SELECT id, google_refresh_token, google_access_token, google_token_expiry
    FROM users WHERE id = ${userId}
  `;
  if (!user || !user.google_refresh_token) throw new DriveNotConnected();
  const exp = user.google_token_expiry ? new Date(user.google_token_expiry).getTime() : 0;
  if (user.google_access_token && exp > Date.now() + 60_000) return user.google_access_token;
  return refreshAccessToken(user);
}

async function driveFetch(userId, url, opts = {}, _retried = false) {
  const token = await accessTokenFor(userId);
  const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (res.status === 401 && !_retried) {
    await sql`UPDATE users SET google_token_expiry = NULL WHERE id = ${userId}`;   // force a refresh
    return driveFetch(userId, url, opts, true);
  }
  return res;
}

// find-or-create the single "cosmos" folder at the Drive root; cache its id on the user
export async function ensureRoot(userId) {
  const [u] = await sql`SELECT drive_root_id FROM users WHERE id = ${userId}`;
  if (u?.drive_root_id) {
    const res = await driveFetch(userId, `${API}/files/${u.drive_root_id}?fields=id,trashed`);
    if (res.ok) { const d = await res.json(); if (!d.trashed) return u.drive_root_id; }
  }
  const q = encodeURIComponent(`name = 'cosmos' and mimeType = '${FOLDER_MIME}' and trashed = false and 'root' in parents`);
  let res = await driveFetch(userId, `${API}/files?q=${q}&fields=files(id)`);
  if (!res.ok) throw new Error('Drive root lookup failed: ' + (await res.text()));
  let id = (await res.json()).files?.[0]?.id;
  if (!id) {
    res = await driveFetch(userId, `${API}/files?fields=id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'cosmos', mimeType: FOLDER_MIME, parents: ['root'] }),
    });
    if (!res.ok) throw new Error('Drive root create failed: ' + (await res.text()));
    id = (await res.json()).id;
  }
  await sql`UPDATE users SET drive_root_id = ${id} WHERE id = ${userId}`;
  return id;
}

const FILE_FIELDS = 'files(id,name,mimeType,size,modifiedTime,fileExtension)';

export async function listFolder(userId, folderId) {
  const parent = folderId || await ensureRoot(userId);
  const q = encodeURIComponent(`'${parent}' in parents and trashed = false`);
  const res = await driveFetch(userId, `${API}/files?q=${q}&fields=${encodeURIComponent(FILE_FIELDS)}&orderBy=folder,name&pageSize=1000`);
  if (!res.ok) throw new Error('Drive list failed: ' + (await res.text()));
  return { parent, root: await ensureRoot(userId), files: (await res.json()).files || [] };
}

export async function search(userId, term) {
  await ensureRoot(userId);   // guarantees a token round-trip & scope
  const safe = term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = encodeURIComponent(`name contains '${safe}' and trashed = false`);
  const res = await driveFetch(userId, `${API}/files?q=${q}&fields=${encodeURIComponent(FILE_FIELDS)}&orderBy=folder,name&pageSize=100`);
  if (!res.ok) throw new Error('Drive search failed: ' + (await res.text()));
  return (await res.json()).files || [];   // drive.file scope → only cosmos-created files
}

export async function createFolder(userId, name, parentId) {
  const parent = parentId || await ensureRoot(userId);
  const res = await driveFetch(userId, `${API}/files?fields=id,name,mimeType,modifiedTime`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
  });
  if (!res.ok) throw new Error('Create folder failed: ' + (await res.text()));
  return res.json();
}

export async function uploadFile(userId, { name, mimeType, bytes, parentId }) {
  const parent = parentId || await ensureRoot(userId);
  const boundary = 'cosmosbnd' + Math.random().toString(36).slice(2);
  const enc = new TextEncoder();
  const metadata = JSON.stringify({ name, parents: [parent] });
  const pre = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`
  );
  const post = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(pre.length + bytes.length + post.length);
  body.set(pre, 0); body.set(bytes, pre.length); body.set(post, pre.length + bytes.length);

  const res = await driveFetch(userId, `${UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime`, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
  if (!res.ok) throw new Error('Upload failed: ' + (await res.text()));
  return res.json();
}

// returns { meta:{name,mimeType,size}, body:ReadableStream } for streaming to the client
export async function downloadFile(userId, fileId) {
  const metaRes = await driveFetch(userId, `${API}/files/${fileId}?fields=name,mimeType,size`);
  if (!metaRes.ok) throw new Error('Download meta failed: ' + (await metaRes.text()));
  const meta = await metaRes.json();
  const res = await driveFetch(userId, `${API}/files/${fileId}?alt=media`);
  if (!res.ok) throw new Error('Download failed: ' + (await res.text()));
  return { meta, body: res.body };
}

export async function trashItem(userId, fileId) {
  const res = await driveFetch(userId, `${API}/files/${fileId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok) throw new Error('Delete failed: ' + (await res.text()));
  return { ok: true };
}

export async function renameItem(userId, fileId, name) {
  const res = await driveFetch(userId, `${API}/files/${fileId}?fields=id,name`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Rename failed: ' + (await res.text()));
  return res.json();
}

export const isFolder = mime => mime === FOLDER_MIME;
