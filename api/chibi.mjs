const MAX_INPUT_BYTES = 3 * 1024 * 1024;
const ALLOWED_SUBJECTS = new Set(["auto", "person", "pet", "object"]);
const ALLOWED_STYLES = new Set(["light", "standard", "cute"]);

export default async function handler(request, response) {
  if (request.method === "GET") {
    return response.status(200).json({ available: Boolean(process.env.OPENAI_API_KEY), provider: "OpenAI" });
  }
  if (request.method !== "POST") return response.status(405).json({ error: "不支援的請求方式" });
  if (!process.env.OPENAI_API_KEY) return response.status(503).json({ error: "AI Q 版服務尚未設定，請先使用直接轉拼豆" });

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const imageDataUrl = body?.imageDataUrl;
    const subjectType = ALLOWED_SUBJECTS.has(body?.subjectType) ? body.subjectType : "auto";
    const stylePreset = ALLOWED_STYLES.has(body?.stylePreset) ? body.stylePreset : "standard";
    const parsed = parseDataUrl(imageDataUrl);
    if (!parsed) return response.status(400).json({ error: "請提供有效的 JPG、PNG 或 WebP 圖片" });
    if (parsed.bytes.length > MAX_INPUT_BYTES) return response.status(413).json({ error: "圖片太大，請改用較小的圖片" });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 110000);
    try {
      const form = new FormData();
      const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst";
      form.append("model", model);
      form.append("image[]", new Blob([parsed.bytes], { type: parsed.mime }), `source.${extensionFor(parsed.mime)}`);
      form.append("prompt", createPrompt(subjectType, stylePreset));
      form.append("size", "1024x1024");
      form.append("quality", "medium");
      form.append("background", "transparent");
      form.append("output_format", "png");
      const providerResponse = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form
      });
      const result = await providerResponse.json();
      if (!providerResponse.ok) {
        const detail = result?.error?.message;
        console.error("Chibi provider error", providerResponse.status, detail);
        return response.status(providerResponse.status >= 500 ? 502 : 400).json({ error: "Q 版生成失敗，請稍後再試或直接使用原圖" });
      }
      const base64 = result?.data?.[0]?.b64_json;
      if (!base64) return response.status(502).json({ error: "Q 版生成服務沒有回傳圖片" });
      return response.status(200).json({ imageDataUrl: `data:image/png;base64,${base64}`, provider: "OpenAI", model });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const timeout = error instanceof Error && error.name === "AbortError";
    console.error("Chibi generation failed", error);
    return response.status(timeout ? 504 : 500).json({ error: timeout ? "Q 版生成逾時，請重新嘗試" : "Q 版生成失敗，原圖已保留" });
  }
}

function parseDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return { mime: match[1], bytes: Buffer.from(match[2], "base64") };
}

function extensionFor(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function createPrompt(subjectType, stylePreset) {
  const subject = subjectType === "person" ? "person" : subjectType === "pet" ? "pet" : subjectType === "object" ? "object" : "main subject";
  const style = stylePreset === "light"
    ? "Use a light chibi treatment with only gentle simplification."
    : stylePreset === "cute"
      ? "Use an extra cute chibi treatment with a larger head and compact proportions."
      : "Use a balanced, polished chibi treatment.";
  return `Edit the supplied image into a clean chibi source illustration designed for later conversion into low-resolution bead art. Preserve the identity and recognizable features of the ${subject}: silhouette, pose, hair or fur pattern, clothing, accessories, and main colors. ${style} Use clear outlines, broad flat color regions, minimal controlled shading, low visual noise, and a transparent background. Keep a single complete subject centered with no text, labels, borders, extra objects, or pixel-art effect.`;
}
