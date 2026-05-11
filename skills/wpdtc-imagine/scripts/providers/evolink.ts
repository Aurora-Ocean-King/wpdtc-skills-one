import type { CliArgs } from "../types";

// ── Constants ──────────────────────────────────────────────
const BASE_URL = "https://api.evolink.ai";
const DEFAULT_MODEL = "gpt-image-2-beta";
const POLL_INTERVAL_MS = 2000; // 2s between status checks
const MAX_POLL_MS = 300_000; // 5 min timeout
const MAX_REFERENCE_IMAGES = 16;
const SUPPORTED_REF_EXTENSIONS = [".jpeg", ".jpg", ".png", ".webp"];

// ── Supported models ───────────────────────────────────────
// All Evolink image-series models that use POST /v1/images/generations

const EVOLINK_IMAGE_MODELS = [
  // GPT Image 2 family
  "gpt-image-2",          // stable — size(ratio/pixel) + resolution + quality(low/medium/high)
  "gpt-image-2-beta",     // beta  — size(ratio) only, no resolution/quality
  // GPT Image 1.5
  "gpt-image-1.5-beta",   // lite  — limited sizes, quality(low/medium/high/auto)
  "gpt-image-1.5-lite",   // legacy alias → gpt-image-1.5-beta
  // Nanobanana 2
  "gemini-3.1-flash-image-preview",  // quality(0.5K/1K/2K/4K), web_search, thinking_level
  "nano-banana-2-beta",              // same as above
  // Nanobanana Pro
  "gemini-3-pro-image-preview",      // quality(1K/2K/4K), web_search
  // Nanobanana v1
  "nano-banana-beta",                // limited ratios, no quality
  "gemini-2.5-flash-image",          // legacy alias → nano-banana-beta
  // Z Image Turbo
  "z-image-turbo",                   // ratio/pixel(376-1536), seed, nsfw
  // Seedream 4.5
  "seedream-4.5",                    // quality(2K/4K), n:1-4, prompt_extend
] as const;

type EvolinkImageModel = (typeof EVOLINK_IMAGE_MODELS)[number];

function isKnownModel(model: string): model is EvolinkImageModel {
  return EVOLINK_IMAGE_MODELS.includes(model as EvolinkImageModel);
}

// ── Model family helpers ───────────────────────────────────

type ModelFamily = "gpt-image-2" | "gpt-image-2-beta" | "gpt-image-1.5" | "nanobanana-2" | "nanobanana-pro" | "nanobanana-v1" | "z-image-turbo" | "seedream";

function getModelFamily(model: string): ModelFamily {
  if (model === "gpt-image-2") return "gpt-image-2";
  if (model === "gpt-image-2-beta") return "gpt-image-2-beta";
  if (model === "gpt-image-1.5-beta" || model === "gpt-image-1.5-lite") return "gpt-image-1.5";
  if (model === "gemini-3.1-flash-image-preview" || model === "nano-banana-2-beta") return "nanobanana-2";
  if (model === "gemini-3-pro-image-preview") return "nanobanana-pro";
  if (model === "nano-banana-beta" || model === "gemini-2.5-flash-image") return "nanobanana-v1";
  if (model === "z-image-turbo") return "z-image-turbo";
  if (model === "seedream-4.5") return "seedream";
  return "gpt-image-2-beta"; // fallback for unknown models
}

function familySupportsResolution(family: ModelFamily): boolean {
  return family === "gpt-image-2";
}

function familySupportsQuality(family: ModelFamily): boolean {
  return family === "gpt-image-2" || family === "gpt-image-1.5" ||
    family === "nanobanana-2" || family === "nanobanana-pro" ||
    family === "seedream";
}

function familySupportsPixelSize(family: ModelFamily): boolean {
  return family === "gpt-image-2" || family === "gpt-image-1.5" ||
    family === "z-image-turbo" || family === "seedream";
}

// ── Type helpers ───────────────────────────────────────────
type EvolinkTaskResponse = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  created: number;
  model: string;
  object: string;
  results?: string[];
  error?: {
    code: string;
    message: string;
    type: string;
  };
};

type EvolinkCreateResponse = {
  id: string;
  status: string;
  progress: number;
  created: number;
  model: string;
  object: string;
};

// ── Exports ────────────────────────────────────────────────

export function getDefaultModel(): string {
  return process.env.EVOLINK_IMAGE_MODEL || DEFAULT_MODEL;
}

function getApiKey(): string | null {
  return process.env.EVOLINK_API_KEY || null;
}

function getBaseUrl(): string {
  const base = process.env.EVOLINK_BASE_URL || BASE_URL;
  return base.replace(/\/+$/g, "");
}

// ── Validation ─────────────────────────────────────────────

export function validateArgs(model: string, args: CliArgs): void {
  if (!model) return;

  // Warn if model is not in the known list, but don't block (API may add new models)
  if (!isKnownModel(model)) {
    console.error(`Warning: "${model}" is not in the known Evolink model list. Proceeding anyway.`);
  }

  const family = getModelFamily(model);

  // Validate aspect ratio if using ratio format
  if (args.aspectRatio && !args.size) {
    const allowedRatios = family === "gpt-image-2-beta" ? [
      "1:1", "1:2", "2:1", "1:3", "3:1",
      "2:3", "3:2", "3:4", "4:3",
      "9:16", "16:9", "9:21", "21:9",
    ] : [
      "1:1", "1:2", "2:1", "1:3", "3:1",
      "2:3", "3:2", "3:4", "4:3", "4:5", "5:4",
      "9:16", "16:9", "9:21", "21:9",
    ];
    if (!allowedRatios.includes(args.aspectRatio)) {
      throw new Error(
        `Evolink (${model}) supports these aspect ratios: ${allowedRatios.join(", ")}. ` +
        `Received: "${args.aspectRatio}". Use --size for custom pixel dimensions.`
      );
    }
  }

  // Validate pixel size (only for families that support it)
  if (args.size && !isAspectRatio(args.size)) {
    if (!familySupportsPixelSize(family)) {
      throw new Error(
        `Evolink (${model}) does not support pixel sizes. Use an aspect ratio (e.g. --ar 16:9) instead.`
      );
    }
    const parsed = parsePixelSize(args.size);
    if (!parsed) {
      throw new Error(
        `Invalid Evolink --size: ${args.size}. Expected <width>x<height> (e.g. 1024x1024) or a ratio like 16:9.`
      );
    }
    const { width, height } = parsed;

    if (family === "z-image-turbo") {
      if (width < 376 || width > 1536 || height < 376 || height > 1536) {
        throw new Error(
          "Evolink z-image-turbo --size dimensions must be between 376 and 1536 pixels."
        );
      }
    } else {
      if (width % 16 !== 0 || height % 16 !== 0) {
        throw new Error(
          "Evolink --size width and height must both be multiples of 16px."
        );
      }
      if (Math.max(width, height) > 3840) {
        throw new Error(
          "Evolink --size maximum edge length must be 3840px or less."
        );
      }
      const ratio = Math.max(width, height) / Math.min(width, height);
      if (ratio > 3) {
        throw new Error(
          "Evolink --size long edge to short edge ratio must not exceed 3:1."
        );
      }
      const pixels = width * height;
      if (pixels < 655_360 || pixels > 8_294_400) {
        throw new Error(
          "Evolink --size total pixels must be between 655,360 and 8,294,400."
        );
      }
    }
  }

  // Validate reference images
  if (args.referenceImages.length > MAX_REFERENCE_IMAGES) {
    throw new Error(
      `Evolink accepts at most ${MAX_REFERENCE_IMAGES} reference images. ` +
      `Received ${args.referenceImages.length}.`
    );
  }

  for (const ref of args.referenceImages) {
    if (/^https?:\/\//i.test(ref)) continue;
    const ext = ref.toLowerCase().slice(ref.lastIndexOf("."));
    if (!SUPPORTED_REF_EXTENSIONS.includes(ext)) {
      throw new Error(
        `Evolink reference images must be .jpeg, .jpg, .png, or .webp. ` +
        `Received: ${ref}. Note: local files must first be uploaded to a public URL; ` +
        `Evolink accepts image_urls (HTTP/HTTPS), not local file paths.`
      );
    }
  }
}

// ── Size helpers ───────────────────────────────────────────

function isAspectRatio(value: string): boolean {
  return /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(value);
}

function parsePixelSize(value: string): { width: number; height: number } | null {
  const match = value.match(/^(\d+)\s*[xX×]\s*(\d+)$/);
  if (!match) return null;
  const width = parseInt(match[1]!, 10);
  const height = parseInt(match[2]!, 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function resolveSize(args: Pick<CliArgs, "aspectRatio" | "size">, _family: ModelFamily): string | undefined {
  if (args.size) {
    if (isAspectRatio(args.size)) return args.size;
    return args.size;
  }
  if (args.aspectRatio) {
    return args.aspectRatio;
  }
  return undefined;
}

// ── API calls ──────────────────────────────────────────────

function buildRequestBody(
  prompt: string,
  model: string,
  args: CliArgs,
): Record<string, unknown> {
  const family = getModelFamily(model);
  const body: Record<string, unknown> = {
    model,
    prompt,
  };

  // Size
  const size = resolveSize(args, family);
  if (size) body.size = size;

  // Resolution — only for gpt-image-2 (stable) with ratio size
  if (familySupportsResolution(family) && size && isAspectRatio(size)) {
    const resolution = args.imageSize === "1K" || args.imageSize === "2K" || args.imageSize === "4K"
      ? args.imageSize
      : (args.quality === "normal" ? "1K" : "2K");
    body.resolution = resolution;
  }

  // Quality — per-family mapping
  if (familySupportsQuality(family)) {
    if (family === "gpt-image-2" || family === "gpt-image-1.5") {
      // GPT Image families: low/medium/high
      body.quality = args.quality === "normal" ? "medium" : "high";
    } else if (family === "nanobanana-2") {
      // Nanobanana 2: 0.5K/1K/2K/4K
      const qMap: Record<string, string> = { "0.5K": "0.5K", "1K": "1K", "2K": "2K", "4K": "4K" };
      const q = args.imageSize ?? (args.quality === "normal" ? "1K" : "2K");
      body.quality = qMap[q] ?? "2K";
    } else if (family === "nanobanana-pro") {
      // Nanobanana Pro: 1K/2K/4K
      const q = args.imageSize === "4K" ? "4K" : (args.quality === "normal" ? "1K" : "2K");
      body.quality = q;
    } else if (family === "seedream") {
      // Seedream: 2K/4K
      const q = args.imageSize === "4K" ? "4K" : "2K";
      body.quality = q;
    }
  }

  // n (number of images)
  if (args.n > 1) body.n = args.n;

  // Reference images (URLs only)
  if (args.referenceImages.length > 0) {
    body.image_urls = args.referenceImages;
  }

  return body;
}

async function createImageTask(
  apiKey: string,
  baseURL: string,
  prompt: string,
  model: string,
  args: CliArgs,
): Promise<EvolinkCreateResponse> {
  const body = buildRequestBody(prompt, model, args);
  const family = getModelFamily(model);

  console.error(`Creating Evolink image task...`, {
    model,
    family,
    size: body.size,
    resolution: body.resolution,
    quality: body.quality,
    n: body.n ?? 1,
    refs: args.referenceImages.length,
  });

  const res = await fetch(`${baseURL}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "Unknown error");
    throw new Error(`Evolink API error (${res.status}): ${err}`);
  }

  return (await res.json()) as EvolinkCreateResponse;
}

async function pollTask(
  apiKey: string,
  baseURL: string,
  taskId: string,
): Promise<EvolinkTaskResponse> {
  const start = Date.now();

  while (Date.now() - start < MAX_POLL_MS) {
    const res = await fetch(`${baseURL}/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "Unknown error");
      throw new Error(`Evolink task query error (${res.status}): ${err}`);
    }

    const task = (await res.json()) as EvolinkTaskResponse;

    if (task.status === "completed" || task.status === "failed") {
      return task;
    }

    console.error(
      `Evolink task ${taskId}: ${task.status} (${task.progress}%)`
    );
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Evolink task ${taskId} timed out after ${MAX_POLL_MS / 1000}s.`
  );
}

async function downloadImage(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image from ${url}: HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

// ── Main generate ──────────────────────────────────────────

export async function generateImage(
  prompt: string,
  model: string,
  args: CliArgs,
): Promise<Uint8Array> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "EVOLINK_API_KEY is required. " +
      "Get your API key at https://evolink.ai/dashboard/keys"
    );
  }

  const baseURL = getBaseUrl();

  // Step 1: Create the image generation task
  const task = await createImageTask(apiKey, baseURL, prompt, model, args);
  console.error(`Evolink task created: ${task.id}`);

  // Step 2: Poll until completed
  const result = await pollTask(apiKey, baseURL, task.id);

  // Step 3: Handle failure
  if (result.status === "failed") {
    const errorMsg = result.error?.message || "Unknown error";
    throw new Error(
      `Evolink task ${task.id} failed: ${errorMsg}`
    );
  }

  // Step 4: Download the first result image
  if (!result.results || result.results.length === 0) {
    throw new Error(
      `Evolink task ${task.id} completed but returned no images.`
    );
  }

  console.error(
    `Evolink task ${task.id} completed. Downloading ${result.results.length} image(s)...`
  );

  // For n > 1, we download the first image (matching existing behavior)
  const imageUrl = result.results[0]!;
  return downloadImage(imageUrl);
}

export function getDefaultOutputExtension(_model: string, _args: CliArgs): string {
  return ".png";
}
