import { clearSessionCookie } from './_session.mjs';

export default async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': clearSessionCookie(),
      'Cache-Control': 'no-store'
    }
  });
};
