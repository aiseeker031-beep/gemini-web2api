# Gemini Media Playground (Cloudflare Worker)

This project serves a single-file image/video testing app and proxies media requests through a Cloudflare Worker. The Google API key stays in a Worker secret; it is never sent to the browser.

## Configure and deploy

1. Install Wrangler and authenticate with a Cloudflare account: `npx wrangler login`.
2. From this directory, add the Google Gemini Developer API key: `npx wrangler secret put GOOGLE_API_KEY`.
3. Create a separate random app token and add it: `npx wrangler secret put APP_ACCESS_TOKEN`.
4. Deploy the site and Worker together: `npx wrangler deploy`.
5. Open the deployed `workers.dev` URL and enter the app token in the UI.

The Gemini API key can be created in Google AI Studio. Image generation uses Google's OpenAI-compatible image endpoint; video generation creates a long-running video operation and the page polls its status.

## API proxy routes

- `POST /api/images/generations` accepts `{ "prompt", "model", "aspect_ratio" }`.
- `POST /api/videos` accepts `{ "prompt", "model" }` and returns the upstream operation.
- `GET /api/videos/{id}` retrieves video generation status and output.

The app requires both Worker secrets to be configured. Do not remove the app-token check on a public deployment: anyone who can call an unprotected route could spend the Google API quota attached to the Worker.

The upstream account's model access, quota and billing rules apply. The browser UI is in `public/index.html` as one standalone HTML file.
