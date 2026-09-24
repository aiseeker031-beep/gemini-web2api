const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/openai";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function errorMessage(message, status) {
  return json({ error: { message } }, status);
}

async function proxy(request, env, path, body) {
  if (!env.GOOGLE_API_KEY || !env.APP_ACCESS_TOKEN) {
    return errorMessage("Worker is not configured. Add GOOGLE_API_KEY and APP_ACCESS_TOKEN secrets.", 503);
  }
  if (request.headers.get("Authorization") !== `Bearer ${env.APP_ACCESS_TOKEN}`) {
    return errorMessage("Invalid app access token.", 401);
  }

  const headers = new Headers({ Authorization: `Bearer ${env.GOOGLE_API_KEY}` });
  if (body instanceof FormData) {
    // Let fetch create the multipart boundary.
  } else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const upstream = await fetch(`${API_ROOT}${path}`, {
      method: request.method,
      headers,
      body,
    });
    const responseBody = await upstream.arrayBuffer();
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorMessage(`Gemini API request failed: ${error.message}`, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": url.origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
      }});
    }

    if (url.pathname === "/api/images/generations" && request.method === "POST") {
      let input;
      try { input = await request.json(); } catch { return errorMessage("Request body must be valid JSON.", 400); }
      if (typeof input.prompt !== "string" || !input.prompt.trim()) return errorMessage("Enter an image prompt.", 400);
      if (input.prompt.length > 10000) return errorMessage("Prompt must be 10,000 characters or fewer.", 413);
      const upstreamBody = {
        model: input.model || "gemini-3.1-flash-image",
        prompt: input.prompt.trim(),
        response_format: "b64_json",
        n: 1,
      };
      // The REST API expects OpenAI-compatible extension parameters at the
      // top level; `extra_body` is an SDK-only option and is rejected here.
      if (input.aspect_ratio) upstreamBody.aspect_ratio = input.aspect_ratio;
      return proxy(request, env, "/images/generations", JSON.stringify(upstreamBody));
    }

    if (url.pathname === "/api/videos" && request.method === "POST") {
      let input;
      try { input = await request.json(); } catch { return errorMessage("Request body must be valid JSON.", 400); }
      if (typeof input.prompt !== "string" || !input.prompt.trim()) return errorMessage("Enter a video prompt.", 400);
      if (input.prompt.length > 10000) return errorMessage("Prompt must be 10,000 characters or fewer.", 413);
      const form = new FormData();
      form.set("model", input.model || "veo-3.1-generate-preview");
      form.set("prompt", input.prompt.trim());
      return proxy(request, env, "/videos", form);
    }

    const videoMatch = url.pathname.match(/^\/api\/videos\/([A-Za-z0-9_-]+)$/);
    if (videoMatch && request.method === "GET") {
      return proxy(request, env, `/videos/${videoMatch[1]}`);
    }
    return errorMessage("Not found.", 404);
  },
};
