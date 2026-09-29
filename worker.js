export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const params = url.searchParams;

    if (!params.has('hash')) {
      return new Response('Missing hash', { status: 400 });
    }

    let checkString = '';
    [...params.keys()].sort().forEach(k => {
      if (k !== 'hash') checkString += `${k}=${params.get(k)}\n`;
    });
    checkString = checkString.trim();

    const enc = new TextEncoder();
    const secretKey = await crypto.subtle.digest('SHA-256', enc.encode(env.BOT_TOKEN));

    const key = await crypto.subtle.importKey(
      'raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(checkString));
    const hash = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');

    if (hash !== params.get('hash')) {
      return new Response('Invalid hash', { status: 401 });
    }

    const name = params.get('first_name') || 'friend';
    return new Response(`<h1>Welcome, ${name}!</h1><p>You are logged in via Telegram.</p>`, {
      headers: { 'content-type': 'text/html' }
    });
  }
};
