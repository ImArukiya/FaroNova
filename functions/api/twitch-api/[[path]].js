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
  const query = url.search;

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
    twitchUrl = `https://api.twitch.tv/helix/streams${query}`;
  } else if (path.startsWith("/clips")) {
    // Support optional first= param for number of clips; default to 10
    const params = new URLSearchParams(url.search);
    if (!params.has("first")) params.set("first", "10");
    twitchUrl = `https://api.twitch.tv/helix/clips?${params.toString()}`;
  } else if (path.startsWith("/videos")) {
    // VODs / past broadcasts
    // Supports ?broadcaster_id=&type=archive|highlight|upload&first=N
    const params = new URLSearchParams(url.search);
    if (!params.has("first")) params.set("first", "6");
    twitchUrl = `https://api.twitch.tv/helix/videos?${params.toString()}`;
  } else if (path.startsWith("/followers")) {
    // Channel follower count: /followers?broadcaster_id=<id>
    twitchUrl = `https://api.twitch.tv/helix/channels/followers${query}`;
  } else if (path.startsWith("/channel")) {
    // Channel info (views, game, title, etc.): /channel?broadcaster_id=<id>
    twitchUrl = `https://api.twitch.tv/helix/channels${query}`;
  } else if (path.startsWith("/schedule")) {
    // Stream schedule: /schedule?broadcaster_id=<id>
    twitchUrl = `https://api.twitch.tv/helix/schedule${query}`;
  } else if (path.startsWith("/tags")) {
    // Channel tags: /tags?broadcaster_id=<id>
    twitchUrl = `https://api.twitch.tv/helix/channel/vips${query}`;
  } else {
    return new Response(
      JSON.stringify({ error: "Unknown route" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const res = await fetch(twitchUrl, { headers });

  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: "Twitch API request failed", status: res.status }),
      { status: res.status, headers: { "Content-Type": "application/json" } }
    );
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
