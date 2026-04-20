// Starts the GitHub OAuth flow. Generates a random state value,
// stashes it in an httpOnly cookie, and redirects the user to GitHub's
// authorize endpoint. No scope is requested; the /user endpoint
// returns the user's numeric id with an unscoped token, which is all
// we need for allow-list checking.

import { randomBytes } from 'node:crypto';
import { stateCookie } from './_session.mjs';

export default async (req, context) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('GITHUB_CLIENT_ID not configured', { status: 500 });
  }

  const siteUrl = process.env.URL || new URL(req.url).origin;
  const redirectUri = `${siteUrl}/api/auth/callback`;

  const state = randomBytes(24).toString('base64url');

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'false');

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': stateCookie(state),
      'Cache-Control': 'no-store'
    }
  });
};
