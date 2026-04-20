// GET  /api/day?date=YYYY-MM-DD  -> 200 {state, updatedAt} or 404
// PUT  /api/day?date=YYYY-MM-DD  -> body {state, updatedAt}
//    200 if accepted, 409 {state, updatedAt} if server's copy is newer.
//
// Auth: ft_session cookie. 401 if missing or invalid.
// Storage: Netlify Blobs, key = `${uid}/${date}` in the "days" store.

import { getStore } from '@netlify/blobs';
import { verifySession } from './_session.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async (req) => {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    return json(500, { error: 'Server not configured' });
  }

  const session = verifySession(req.headers.get('cookie'), sessionSecret);
  if (!session) return json(401, { error: 'Unauthorized' });

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date || !DATE_RE.test(date)) {
    return json(400, { error: 'Invalid or missing date' });
  }

  const store = getStore('days');
  const key = `${session.uid}/${date}`;

  if (req.method === 'GET') {
    const existing = await store.get(key, { type: 'json' });
    if (!existing) return json(404, { error: 'Not found' });
    return json(200, existing);
  }

  if (req.method === 'PUT') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }
    if (!body || typeof body !== 'object' || !body.state || !body.updatedAt) {
      return json(400, { error: 'Body must include state and updatedAt' });
    }

    const existing = await store.get(key, { type: 'json' });
    if (existing && existing.updatedAt > body.updatedAt) {
      // Server is newer — reject and hand back server state so the client adopts it.
      return json(409, existing);
    }

    await store.setJSON(key, { state: body.state, updatedAt: body.updatedAt });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
