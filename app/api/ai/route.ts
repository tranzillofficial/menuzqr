import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { aiConfigured, runAi, type AiTask } from "@/lib/ai";

const TASKS: AiTask[] = [
  "product_names",
  "product_description",
  "product_ingredients",
  "product_full",
  "categories",
];

// Small in-memory throttle. Good enough for a single-instance deployment;
// swap for a shared store if you scale horizontally.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;
const hits = new Map<string, number[]>();

function throttled(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });
  }

  if (throttled(user.id)) {
    return NextResponse.json(
      { ok: false, message: "Too many AI requests. Wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: { task?: string; input?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const task = body.task as AiTask;
  if (!TASKS.includes(task)) {
    return NextResponse.json({ ok: false, message: "Unknown AI task." }, { status: 400 });
  }

  const input: Record<string, string> = {};
  for (const [key, value] of Object.entries(body.input ?? {})) {
    if (typeof value === "string") input[key] = value.slice(0, 600);
  }

  const result = await runAi(task, input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, data: result.data });
}

/** Quick "is the AI wired up?" check for a signed-in user. */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    configured: aiConfigured(),
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
  });
}
