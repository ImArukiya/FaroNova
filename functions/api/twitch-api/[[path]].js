export async function onRequest(context) {
  const { request, env } = context;

  const CLIENT_ID = env.TWITCH_CLIENT_ID;
  const CLIENT_SECRET = env.TWITCH_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "Twitch credentials not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Get app access token via client credentials ──────────────────────────
  // This token works for: Get Users, Get Streams, Get Clips, Get Videos,
  // Get Games, Get Channel Info, Get Channel Followers (total count only)
  const tokenRes = await fetch(
    "https://id.twitch.tv/oauth2/token" +
      "?client_id=" + encodeURIComponent(CLIENT_ID) +
      "&client_secret=" + encodeURIComponent(CLIENT_SECRET) +
      "&grant_type=client_credentials",
    { method: "POST" }
  );

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: "Failed to obtain Twitch access token", detail: body }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const { access_token } = await tokenRes.json();

  const authHeaders = {
    "Client-ID": CLIENT_ID,
    "Authorization": "Bearer " + access_token,
  };

  // ── Route dispatch ────────────────────────────────────────────────────────
  const url = new URL(request.url);
  // Strip the proxy prefix to get the sub-path, e.g. "/user", "/stream", ...
  const path = url.pathname.replace(/^\/api\/twitch-api\/?/, "/");

  let twitchUrl;

  if (path.startsWith("/user")) {
    // GET /helix/users — app token OK
    // Accept ?username= (our alias) or standard ?login= / ?id=
    const params = new URLSearchParams(url.search);
    if (params.has("username")) {
      params.set("login", params.get("username"));
      params.delete("username");
    }
    twitchUrl = "https://api.twitch.tv/helix/users?" + params.toString();

  } else if (path.startsWith("/stream")) {
    // GET /helix/streams — app token OK
    twitchUrl = "https://api.twitch.tv/helix/streams" + url.search;

  } else if (path.startsWith("/clips")) {
    // GET /helix/clips — app token OK
    const params = new URLSearchParams(url.search);
    if (!params.has("first")) params.set("first", "10");
    twitchUrl = "https://api.twitch.tv/helix/clips?" + params.toString();

  } else if (path.startsWith("/videos")) {
    // GET /helix/videos — app token OK
    // Accepts broadcaster_id, user_id, id — all work
    const params = new URLSearchParams(url.search);
    if (!params.has("first")) params.set("first", "6");
    // Normalise: frontend may send user_id, Twitch accepts broadcaster_id too
    if (params.has("user_id") && !params.has("broadcaster_id")) {
      params.set("broadcaster_id", params.get("user_id"));
      params.delete("user_id");
    }
    twitchUrl = "https://api.twitch.tv/helix/videos?" + params.toString();

  } else if (path.startsWith("/followers")) {
    // GET /helix/channels/followers — app token returns { total, data:[] }
    // Full data requires moderator:read:followers user token, but total is fine
    twitchUrl = "https://api.twitch.tv/helix/channels/followers" + url.search;

  } else if (path.startsWith("/channel")) {
    // GET /helix/channels — app token OK
    twitchUrl = "https://api.twitch.tv/helix/channels" + url.search;

  } else if (path.startsWith("/games")) {
    // GET /helix/games — app token OK; accepts ?name= and/or ?id=
    twitchUrl = "https://api.twitch.tv/helix/games" + url.search;

  } else {
    return new Response(
      JSON.stringify({ error: "Unknown route: " + path }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Forward request to Twitch ─────────────────────────────────────────────
  const res = await fetch(twitchUrl, { headers: authHeaders });

  // Pass Twitch error body through so the client can see what went wrong
  if (!res.ok) {
    const errBody = await res.text().catch(() => "{}");
    return new Response(errBody, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    },
  });
}
