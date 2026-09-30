const HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>My Telegram Login</title></head><body><h1>Login with Telegram</h1><script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="Ailrnbot" data-size="large" data-auth-url="https://telegram-login.aderaw162.workers.dev" data-request-access="write"></script></body></html>';

const ADMIN_PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Admin</title></head><body style="font-family:Arial;padding:20px;max-width:600px;margin:auto">
<h1>Admin Panel</h1>
<div id="login">
<p>Enter admin password:</p>
<input id="pw" type="password" style="padding:8px;font-size:14px;width:60%">
<button onclick="login()" style="padding:8px 16px;font-size:14px">Login</button>
</div>
<div id="panel" style="display:none">
<p id="count">Loading...</p>
<textarea id="msg" placeholder="Type your message..." style="width:100%;height:120px;padding:8px;font-size:14px"></textarea><br><br>
<button onclick="send()" style="padding:10px 20px;font-size:16px;background:#0088cc;color:white;border:none;border-radius:5px">Send to All Users</button>
<p id="status"></p>
</div>
<script>
var pw = '';
function login(){
  pw = document.getElementById('pw').value;
  if(!pw) return alert('Enter password');
  document.getElementById('login').style.display='none';
  document.getElementById('panel').style.display='block';
  loadCount();
}
async function loadCount(){
  var r = await fetch('/admin/users',{headers:{'x-admin':pw}});
  if(r.status!==200){alert('Wrong password');document.getElementById('login').style.display='block';document.getElementById('panel').style.display='none';return;}
  var d = await r.json();
  document.getElementById('count').textContent='Total users: '+(d.count||0);
}
async function send(){
  var m=document.getElementById('msg').value;
  if(!m.trim()) return alert('Type a message first');
  document.getElementById('status').textContent='Sending...';
  var r=await fetch('/admin/send',{method:'POST',headers:{'content-type':'application/json','x-admin':pw},body:JSON.stringify({message:m})});
  var d=await r.json();
  document.getElementById('status').textContent='Sent: '+(d.sent||0)+' / '+(d.total||0);
}
</script></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const params = url.searchParams;
    const path = url.pathname;

    if (path === "/admin") {
      return new Response(ADMIN_PAGE, { headers: { "content-type": "text/html" } });
    }

    if (path === "/admin/users") {
      if (request.headers.get("x-admin") !== env.ADMIN_PASSWORD) {
        return new Response("Unauthorized", { status: 401 });
      }
      const r = await env.DB.prepare("SELECT COUNT(*) as c FROM users").first();
      return Response.json({ count: r.c });
    }

    if (path === "/admin/send") {
      if (request.headers.get("x-admin") !== env.ADMIN_PASSWORD) {
        return new Response("Unauthorized", { status: 401 });
      }
      const body = await request.json();
      const result = await env.DB.prepare("SELECT id FROM users").all();
      let sent = 0;
      for (const u of result.results) {
        const apiUrl = "https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage";
        const r = await fetch(apiUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: u.id, text: body.message })
        });
        if (r.ok) sent++;
      }
      return Response.json({ sent: sent, total: result.results.length });
    }

    if (!params.has("hash")) {
      return new Response(HTML, { headers: { "content-type": "text/html" } });
    }

    let checkString = "";
    [...params.keys()].sort().forEach(k => {
      if (k !== "hash") checkString += k + "=" + params.get(k) + "\n";
    });
    checkString = checkString.trim();

    const enc = new TextEncoder();
    const secretKey = await crypto.subtle.digest("SHA-256", enc.encode(env.BOT_TOKEN));
    const key = await crypto.subtle.importKey("raw", secretKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(checkString));
    const hash = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");

    if (hash !== params.get("hash")) {
      return new Response("Invalid hash", { status: 401 });
    }

    const id = params.get("id");
    await env.DB.prepare(
      "INSERT OR REPLACE INTO users (id, first_name, last_name, username, photo_url, auth_date) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, params.get("first_name") || "", params.get("last_name") || "", params.get("username") || "", params.get("photo_url") || "", params.get("auth_date") || "").run();

    const notifyText = "🔔 New login: " + (params.get("first_name") || "") + " " + (params.get("last_name") || "") + " (@" + (params.get("username") || "none") + ") - ID: " + id;
    const notifyUrl = "https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage";
    await fetch(notifyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.MY_CHAT_ID, text: notifyText })
    });

    const name = params.get("first_name") || "friend";
    return new Response("<h1>Welcome, " + name + "!</h1><p>You are logged in via Telegram.</p>", {
      headers: { "content-type": "text/html" }
    });
  }
};

