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

  // Get app access token
  const tokenRes = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!tokenRes.ok) {
    return new Response(
      JSON.stringify({ error: "Failed to get Twitch access token" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const { access_token } = await tokenRes.json();

  const headers = {
    "Client-ID": CLIENT_ID,
    "Authorization": `Bearer ${access_token}`,
  };

  // Extract sub-route from the URL path
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/twitch-api/, "");

  let twitchUrl;

  if (path.startsWith("/user")) {
    // Twitch uses "login" not "username"
    const params = new URLSearchParams(url.search);
    if (params.has("username")) {
      params.set("login", params.get("username"));
      params.delete("username");
    }
    twitchUrl = `https://api.twitch.tv/helix/users?${params.toString()}`;

  } else if (path.startsWith("/stream")) {
    twitchUrl = `https://api.twitch.tv/helix/streams${url.search}`;

  } else if (path.startsWith("/clips")) {
    twitchUrl = `https://api.twitch.tv/helix/clips${url.search}`;

  } else if (path.startsWith("/followers")) {
    twitchUrl = `https://api.twitch.tv/helix/channels/followers${url.search}`;

  } else if (path.startsWith("/channel")) {
    twitchUrl = `https://api.twitch.tv/helix/channels${url.search}`;

  } else if (path.startsWith("/videos")) {
    twitchUrl = `https://api.twitch.tv/helix/videos${url.search}`;

  } else if (path.startsWith("/games")) {
    twitchUrl = `https://api.twitch.tv/helix/games${url.search}`;

  } else {
    return new Response(
      JSON.stringify({ error: "Unknown route" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const res = await fetch(twitchUrl, { headers });

  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: "Twitch API request failed" }),
      { status: res.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

