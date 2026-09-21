import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/chibi.mjs";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("Q版 API status does not expose the API key", async () => {
  const original = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "server-secret";
  const response = responseRecorder();
  await handler({ method: "GET" }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { available: true, provider: "OpenAI" });
  assert.equal(JSON.stringify(response.body).includes("server-secret"), false);
  if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original;
});

test("Q版 API calls the server-side image edit provider", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "server-secret";
  let authorization = "";
  globalThis.fetch = async (_url, options) => {
    authorization = options.headers.Authorization;
    assert.ok(options.body instanceof FormData);
    return new Response(JSON.stringify({ data: [{ b64_json: "aW1hZ2U=" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const response = responseRecorder();
  await handler({ method: "POST", body: { imageDataUrl: "data:image/png;base64,aW1hZ2U=", subjectType: "pet", stylePreset: "standard" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.imageDataUrl, "data:image/png;base64,aW1hZ2U=");
  assert.equal(authorization, "Bearer server-secret");
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
});
