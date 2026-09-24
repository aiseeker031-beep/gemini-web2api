"""Proxy media-generation requests to Google's OpenAI-compatible Gemini API."""
import json
import urllib.error
import urllib.request

from .config import CONFIG

UPSTREAM_ROOT = "https://generativelanguage.googleapis.com/v1beta/openai"


def forward_request(path: str, method: str, body: bytes = b"", content_type: str = "application/json"):
    """Return (status, response_body, response_content_type) from Gemini API."""
    api_key = CONFIG.get("google_api_key")
    if not api_key:
        return 503, json.dumps({
            "error": {
                "message": "Media generation is disabled. Set google_api_key in config.json to a Gemini API key."
            }
        }).encode(), "application/json"

    request = urllib.request.Request(
        UPSTREAM_ROOT + path,
        data=body if method != "GET" else None,
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": content_type,
            "Accept": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=CONFIG["request_timeout_sec"]) as response:
            return response.status, response.read(), response.headers.get("Content-Type", "application/json")
    except urllib.error.HTTPError as error:
        return error.code, error.read(), error.headers.get("Content-Type", "application/json")
    except Exception as error:
        payload = json.dumps({"error": {"message": "Gemini media API request failed: " + str(error)}}).encode()
        return 502, payload, "application/json"
