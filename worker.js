const HTML = `<!DOCTYPE html>
<html>
<head>
  <title>My Telegram Login</title>
</head>
<body>
  <h1>Login with Telegram</h1>
  <script async src="https://telegram.org/js/telegram-widget.js?22"
    data-telegram-login="Ailrnbot"
    data-size="large"
    data-auth-url="https://telegram-login.aderaw162.workers.dev"
    data-request-access="write">
  </script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const params = url.searchParams;

    if (!params.has('hash')) {
      return new Response(HTML, {
        headers: { 'content-type': 'text/html' }
      });
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
    console.log('LOGIN:', JSON.stringify({
  id: params.get('id'),
  first_name: params.get('first_name'),
  last_name: params.get('last_name'),
  username: params.get('username'),
  photo_url: params.get('photo_url'),
  auth_date: params.get('auth_date')
}));    
const msg = `🔔 New login: ${params.get('first_name') || ''} ${params.get('last_name') || ''} (@${params.get('username') || 'none'}) - ID: ${params.get('id')}`;
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat_id: env.MY_CHAT_ID, text: msg })
});
    const name = params.get('first_name') || 'friend';
    return new Response(`<h1>Welcome, ${name}!</h1><p>You are logged in via Telegram.</p>`, {
      headers: { 'content-type': 'text/html' }
    });
  }
};
