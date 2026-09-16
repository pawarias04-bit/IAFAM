// manage-user: suspender o reactivar el acceso de un usuario (BO-081).
//
// Hace falta una Edge Function porque bloquear la cuenta en Supabase Auth
// exige la clave service_role, que nunca puede estar en el navegador.
//
// Orden de las operaciones:
//   1. La base de datos, con la sesión de quien llama: comprueba el permiso
//      users.suspend, aplica las reglas BO-003/BO-004 y deja la auditoría
//      con autor y motivo. Si algo no está permitido, se para aquí.
//   2. Supabase Auth, con service_role: bloquea o desbloquea el inicio de
//      sesión. Si falla, se deshace el paso 1 para no dejar el perfil y la
//      cuenta de acceso en estados distintos.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Supabase Auth no tiene "bloqueo indefinido": 100 años lo es en la práctica.
const BAN_FOREVER = "876000h";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Necesitas iniciar sesión." }, 401);

  let payload: { action?: string; user_id?: string; reason?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Petición no válida." }, 400);
  }

  const { action, user_id: userId, reason } = payload ?? {};
  if (!["suspend", "reactivate"].includes(action ?? "") || !UUID_RE.test(userId ?? "")) {
    return json({ error: "Petición no válida." }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const active = action === "reactivate";

  // 1. Base de datos, como quien llama.
  const { error: dbError } = await asCaller.rpc("set_user_active", {
    p_user_id: userId,
    p_active: active,
    p_reason: reason ?? null,
  });
  if (dbError) {
    const status = dbError.code === "42501" ? 403 : 400;
    return json({ error: dbError.message, code: dbError.code }, status);
  }

  // 2. Supabase Auth.
  const { error: authError } = await admin.auth.admin.updateUserById(userId!, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  if (authError) {
    await asCaller.rpc("set_user_active", {
      p_user_id: userId,
      p_active: !active,
      p_reason: `Reversión automática: Supabase Auth rechazó el cambio (${authError.message})`,
    });
    return json(
      { error: "No se pudo cambiar el acceso en Supabase Auth. No se ha aplicado ningún cambio." },
      502,
    );
  }

  return json({ ok: true, is_active: active });
});
