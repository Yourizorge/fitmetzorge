import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_AUTH_REDIRECT_URL = "https://appfmz.nl";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Supabase environment variables ontbreken.");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Niet ingelogd." }, 401);
    }

    const { data: trainerProfile, error: profileError } = await userClient
      .from("profiles")
      .select("id, role")
      .eq("id", userData.user.id)
      .single();

    if (profileError || trainerProfile?.role !== "trainer") {
      return json({ error: "Alleen trainers kunnen leden uitnodigen." }, 403);
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const clientId = String(body.clientId || "").trim();
    const redirectTo = safeAuthRedirect(body.redirectTo || Deno.env.get("SITE_URL") || "");

    if (!email || !name || !clientId) {
      return json({ error: "Naam, e-mail en clientId zijn verplicht." }, 400);
    }

    const { data: prepared, error: prepareError } = await userClient.rpc("fmz_prepare_invite", {
      client_id: clientId, email, display_name: name
    });
    if (prepareError || !prepared?.ok) return json({ error: "Uitnodiging geweigerd. Controleer de opgeslagen klant en bestaande koppeling." }, 409);
    if (prepared.alreadyRegistered) return json({ ok: true, alreadyRegistered: true });

    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        role: "client",
        name,
        trainer_id: userData.user.id,
        client_id: clientId
      },
      redirectTo
    });

    if (inviteError && !/already|registered|exists/i.test(inviteError.message)) {
      throw inviteError;
    }

    return json({
      ok: true,
      alreadyRegistered: Boolean(inviteError)
    });
  } catch (error) {
    return json({ error: error.message || "Uitnodiging mislukt." }, 500);
  }
});

function safeAuthRedirect(value: unknown) {
  const candidate = String(value || "").trim();
  try {
    const url = new URL(candidate);
    if (url.origin === APP_AUTH_REDIRECT_URL) {
      return APP_AUTH_REDIRECT_URL;
    }
  } catch {
    // Fall through to the webapp URL.
  }
  return APP_AUTH_REDIRECT_URL;
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

