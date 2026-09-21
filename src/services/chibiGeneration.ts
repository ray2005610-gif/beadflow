export type ChibiSubjectType = "auto" | "person" | "pet" | "object";
export type ChibiStylePreset = "light" | "standard" | "cute";

export type ChibiGenerationRequest = {
  imageDataUrl: string;
  subjectType: ChibiSubjectType;
  stylePreset: ChibiStylePreset;
};

export type ChibiGenerationResult = {
  imageDataUrl: string;
  provider: string;
  model: string;
};

export type ChibiServiceStatus = {
  available: boolean;
  provider?: string;
};

export async function getChibiServiceStatus(signal?: AbortSignal): Promise<ChibiServiceStatus> {
  const response = await fetch("/api/chibi", { method: "GET", signal, headers: { Accept: "application/json" } });
  if (!response.ok) return { available: false };
  const data = await response.json() as ChibiServiceStatus;
  return { available: Boolean(data.available), provider: data.provider };
}

export async function generateChibiImage(request: ChibiGenerationRequest, signal?: AbortSignal): Promise<ChibiGenerationResult> {
  const prepared = await prepareImageForGeneration(request.imageDataUrl);
  const response = await fetch("/api/chibi", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...request, imageDataUrl: prepared })
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Q 版生成失敗，請稍後再試");
  if (typeof data.imageDataUrl !== "string" || !data.imageDataUrl.startsWith("data:image/")) throw new Error("生成服務沒有回傳有效圖片");
  return {
    imageDataUrl: data.imageDataUrl,
    provider: typeof data.provider === "string" ? data.provider : "OpenAI",
    model: typeof data.model === "string" ? data.model : "GPT Image"
  };
}

async function prepareImageForGeneration(source: string): Promise<string> {
  const image = await loadImage(source);
  const maxEdge = 1536;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("無法準備 Q 版輸入圖片");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片格式無法用於 Q 版生成"));
    image.src = source;
  });
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}
