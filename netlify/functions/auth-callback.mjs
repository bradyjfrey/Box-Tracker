// OAuth callback. GitHub redirects here with ?code and ?state.
// We verify state against the cookie (CSRF), exchange the code for
// an access token, look up the GitHub user id, check it against the
// allow-list, and issue a session cookie.

import {
  signSession,
  sessionCookie,
  stateCookie,
  clearStateCookie,
  readStateCookie
} from './_session.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const allowedId = process.env.ALLOWED_GITHUB_USER_ID;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!clientId || !clientSecret || !allowedId || !sessionSecret) {
    return new Response('Server not configured', { status: 500 });
  }
  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  const cookieHeader = req.headers.get('cookie');
  const expectedState = readStateCookie(cookieHeader);
  if (!expectedState || expectedState !== state) {
    return new Response('State mismatch', { status: 400 });
  }

  // Exchange code for access token.
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
  });
  if (!tokenRes.ok) {
    return new Response('Token exchange failed', { status: 502 });
  }
  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    return new Response('No access token returned', { status: 502 });
  }

  // Look up the authenticated user's numeric id.
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'food-tracker'
    }
  });
  if (!userRes.ok) {
    return new Response('User lookup failed', { status: 502 });
  }
  const user = await userRes.json();

  // Allow-list check. We compare as strings to avoid any type surprises.
  if (String(user.id) !== String(allowedId)) {
    // Still clear the state cookie on rejection.
    return new Response('Not authorized', {
      status: 403,
      headers: { 'Set-Cookie': clearStateCookie() }
    });
  }

  const session = signSession(String(user.id), sessionSecret);

  // Multiple Set-Cookie headers: standard Headers can hold repeats.
  const headers = new Headers({
    Location: '/',
    'Cache-Control': 'no-store'
  });
  headers.append('Set-Cookie', sessionCookie(session));
  headers.append('Set-Cookie', clearStateCookie());

  return new Response(null, { status: 302, headers });
};
