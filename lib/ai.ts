import "server-only";

export type AiTask =
  | "product_names"
  | "product_description"
  | "product_ingredients"
  | "product_full"
  | "categories";

export type AiResult = {
  nameSuggestions: string[];
  description: string;
  ingredients: string[];
  categorySuggestion: string;
  variantSuggestions: string[];
  categorySuggestions: string[];
};

const EMPTY: AiResult = {
  nameSuggestions: [],
  description: "",
  ingredients: [],
  categorySuggestion: "",
  variantSuggestions: [],
  categorySuggestions: [],
};

// Gemini's responseSchema is an OpenAPI subset whose `type` values are the
// UPPERCASE Type enum (OBJECT / STRING / ARRAY). Lowercase is rejected with a
// 400, which is silent from the caller's point of view.
const SCHEMA = {
  type: "OBJECT",
  properties: {
    nameSuggestions: { type: "ARRAY", items: { type: "STRING" } },
    description: { type: "STRING" },
    ingredients: { type: "ARRAY", items: { type: "STRING" } },
    categorySuggestion: { type: "STRING" },
    variantSuggestions: { type: "ARRAY", items: { type: "STRING" } },
    categorySuggestions: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "nameSuggestions",
    "description",
    "ingredients",
    "categorySuggestion",
    "variantSuggestions",
    "categorySuggestions",
  ],
} as const;

function buildPrompt(task: AiTask, input: Record<string, string>): string {
  const lang =
    input.language === "ar"
      ? "Write all output in Arabic."
      : "Write all output in English.";

  const context = [
    input.restaurantName && `Restaurant: ${input.restaurantName}`,
    input.restaurantType && `Restaurant type: ${input.restaurantType}`,
    input.categories && `Existing menu sections: ${input.categories}`,
    input.name && `Item the owner typed: ${input.name}`,
    input.details && `Extra details from the owner: ${input.details}`,
  ]
    .filter(Boolean)
    .join("\n");

  const instructions: Record<AiTask, string> = {
    product_names:
      "Return 3 short, appetising menu names for this item in `nameSuggestions`. Keep each under 40 characters. No emoji, no quotes, no prices. Leave every other field empty.",
    product_description:
      "Return one appetising menu description (max 220 characters, 1–2 sentences) in `description`. Describe what is in the dish, not marketing fluff. Leave every other field empty.",
    product_ingredients:
      "Return 4–8 likely ingredients in `ingredients`, each 1–3 words. Leave every other field empty.",
    product_full:
      "Fill `nameSuggestions` (3 options), `description` (max 220 characters), `ingredients` (4–8 items), `categorySuggestion` (one menu section name, reuse one of the existing sections when a sensible one exists) and `variantSuggestions` (2–3 size or portion names such as Small/Medium/Large or Regular/Double — names only, never prices). Leave `categorySuggestions` empty.",
    categories:
      "Return 6–9 menu section names for this restaurant in `categorySuggestions`, ordered the way a customer reads a menu. Leave every other field empty.",
  };

  return `You are a menu writer for restaurants and cafés.
${lang}
Never invent allergy, nutrition or dietary-safety claims. Never include prices.

${context}

Task: ${instructions[task]}
Respond with JSON only.`;
}

function coerce(value: unknown): AiResult {
  const o = (value ?? {}) as Record<string, unknown>;
  const arr = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter((x) => x.length > 0 && x.length <= 80)
          .slice(0, max)
      : [];

  return {
    nameSuggestions: arr(o.nameSuggestions, 5),
    description:
      typeof o.description === "string" ? o.description.trim().slice(0, 400) : "",
    ingredients: arr(o.ingredients, 12),
    categorySuggestion:
      typeof o.categorySuggestion === "string"
        ? o.categorySuggestion.trim().slice(0, 60)
        : "",
    variantSuggestions: arr(o.variantSuggestions, 6),
    categorySuggestions: arr(o.categorySuggestions, 12),
  };
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function runAi(
  task: AiTask,
  input: Record<string, string>
): Promise<{ ok: true; data: AiResult } | { ok: false; message: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "AI suggestions are not configured on this server." };
  }

  // gemini-2.0-flash by default: fast, widely available, and it does not spend
  // the output budget on hidden thinking tokens the way 2.5 can.
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(task, input) }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[ai] ${model} -> ${response.status}`, body.slice(0, 600));

      if (response.status === 429) {
        return { ok: false, message: "AI is busy right now. Try again in a moment." };
      }

      // Surface the real reason — a bad key or a model the key cannot use are
      // the two things that actually go wrong, and both are fixable by the user.
      let detail = "";
      try {
        detail = (JSON.parse(body) as { error?: { message?: string } })?.error?.message ?? "";
      } catch {
        detail = body.slice(0, 200);
      }

      if (response.status === 400 && /API key not valid/i.test(detail)) {
        return { ok: false, message: "The Gemini API key is not valid. Check GEMINI_API_KEY." };
      }
      if (response.status === 403) {
        return { ok: false, message: "The Gemini API key is not authorised for this model." };
      }
      if (response.status === 404) {
        return {
          ok: false,
          message: `Model "${model}" is not available for this key. Set GEMINI_MODEL to one your key supports.`,
        };
      }
      return {
        ok: false,
        message: detail ? `AI error: ${detail}` : "AI suggestions are temporarily unavailable.",
      };
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
    };

    if (payload.promptFeedback?.blockReason) {
      return { ok: false, message: "AI declined that request. Try different wording." };
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) {
      const finish = payload.candidates?.[0]?.finishReason;
      console.error(`[ai] empty candidate (${finish ?? "no reason"})`, JSON.stringify(payload).slice(0, 600));

      // Thinking models can spend the whole output budget before writing an
      // answer. Saying so beats "try again", which never helps.
      if (finish === "MAX_TOKENS") {
        return {
          ok: false,
          message: `Model "${model}" ran out of output budget. Try GEMINI_MODEL=gemini-2.0-flash.`,
        };
      }
      return { ok: false, message: "AI returned an empty answer. Try again." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, message: "AI returned an unexpected response. Try again." };
    }

    return { ok: true, data: coerce(parsed) };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      return { ok: false, message: "AI took too long to answer. Try again." };
    }
    console.error("Gemini request failed", error);
    return { ok: false, message: "AI suggestions are temporarily unavailable." };
  } finally {
    clearTimeout(timeout);
  }
}
