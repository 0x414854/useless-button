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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante." },
      { status: 500 },
    );
  }

  const browserId = request.nextUrl.searchParams.get("browserId");

  if (!browserId || !UUID_PATTERN.test(browserId)) {
    return NextResponse.json(
      { error: "Identifiant de navigateur invalide." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .schema("useless")
    .rpc("get_leaderboards", {
      p_browser_id: browserId,
    });

  if (error) {
    console.error("Erreur lecture classements:", error.message);
    return NextResponse.json(
      { error: "Impossible de charger les classements." },
      { status: 500 },
    );
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
