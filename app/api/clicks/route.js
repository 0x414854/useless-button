import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

const supabase =
  supabaseUrl && supabaseSecretKey
    ? createClient(supabaseUrl, supabaseSecretKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

// Protection temporaire par instance.
// À remplacer par une limitation distribuée en production.
const recentClicks = new Map();
const COOLDOWN_MS = 500;
const MAX_TRACKED_IPS = 10_000;

function jsonError(message, status) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === request.nextUrl.origin;
}

function getClientKey(request) {
  // Vercel fournit normalement x-forwarded-for.
  // Cette valeur sert uniquement à une limitation temporaire.
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

function isValidUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export async function GET() {
  if (!supabase) {
    return jsonError("Configuration Supabase manquante.", 500);
  }

  const { data, error } = await supabase
    .schema("useless")
    .rpc("get_global_clicks");

  if (error) {
    console.error("Erreur lecture compteur:", error.message);
    return jsonError("Impossible de lire le compteur.", 500);
  }

  return NextResponse.json(
    { total: Number(data) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request) {
  if (!supabase) {
    return jsonError("Configuration Supabase manquante.", 500);
  }

  if (!isSameOrigin(request)) {
    return jsonError("Origine non autorisée.", 403);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonError("Corps JSON invalide.", 400);
  }

  const browserId = body?.browserId;

  if (!isValidUuid(browserId)) {
    return jsonError("Identifiant de navigateur invalide.", 400);
  }

  const key = getClientKey(request);
  const now = Date.now();
  const lastClick = recentClicks.get(key) ?? 0;

  if (now - lastClick < COOLDOWN_MS) {
    return jsonError("Un peu de patience entre deux clics.", 429);
  }

  // Éviter que la Map grandisse indéfiniment.
  if (!recentClicks.has(key) && recentClicks.size >= MAX_TRACKED_IPS) {
    return jsonError("Trop de requêtes. Réessaie plus tard.", 503);
  }

  recentClicks.set(key, now);

  // Header fourni par l'infrastructure Vercel en production.
  const headerCountry = request.headers.get("x-vercel-ip-country");
  const countryCode =
    headerCountry && /^[A-Za-z]{2}$/.test(headerCountry)
      ? headerCountry.toUpperCase()
      : null;

  const { data, error } = await supabase.schema("useless").rpc("record_click", {
    p_browser_id: browserId,
    p_country_code: countryCode,
  });

  if (error) {
    recentClicks.delete(key);
    console.error("Erreur incrémentation:", error.message);
    return jsonError("Le clic n'a pas pu être enregistré.", 500);
  }

  // record_click renvoie un objet JSON, pas un nombre.
  return NextResponse.json(
    {
      total: Number(data.global_total),
      userTotal: Number(data.user_total),
      dailyTotal: Number(data.daily_total),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
