// ENVIAR AVISOS: se ejecuta cada minuto (tarea programada en sql/avisos.sql).
// Busca los avisos que ya tocan y los manda como notificación a cada dispositivo de su dueño.
// Solo responde a la tarea programada: comprueba el código secreto "avisos_cron" del Vault.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

let claves: Record<string, string> | null = null;
async function leerClaves() {
  if (claves) return claves;
  const { data, error } = await supabase.rpc("avisos_claves");
  if (error || !data) throw new Error(`Sin claves: ${error?.message}`);
  claves = data as Record<string, string>;
  webpush.setVapidDetails("mailto:avisos@synco.app", claves.avisos_vapid_publica, claves.avisos_vapid_privada);
  return claves;
}

Deno.serve(async (req) => {
  try {
    const c = await leerClaves();
    if (req.headers.get("x-avisos-cron") !== c.avisos_cron) return new Response("No", { status: 401 });

    // Lo que toca ahora (y lo de las 2 últimas horas, por si algún minuto falló). Lo más viejo se descarta.
    const ahora = new Date();
    const { data: avisos, error } = await supabase.from("avisos")
      .select("user_id, clave, titulo, cuerpo, url")
      .eq("enviado", false)
      .lte("cuando", ahora.toISOString())
      .gte("cuando", new Date(ahora.getTime() - 2 * 3600e3).toISOString())
      .limit(200);
    if (error) throw error;
    if (!avisos?.length) return Response.json({ enviados: 0 });

    // Se marcan antes de enviar: mejor perder uno que mandarlo dos veces
    for (const a of avisos) {
      await supabase.from("avisos").update({ enviado: true }).eq("user_id", a.user_id).eq("clave", a.clave);
    }

    const usuarios = [...new Set(avisos.map((a) => a.user_id))];
    const { data: dispositivos } = await supabase.from("avisos_dispositivos")
      .select("endpoint, user_id, p256dh, auth").in("user_id", usuarios);

    let enviados = 0;
    const caducados = new Set<string>();
    for (const a of avisos) {
      const carga = JSON.stringify({ titulo: a.titulo, cuerpo: a.cuerpo, url: a.url, tag: a.clave });
      for (const d of (dispositivos || []).filter((x) => x.user_id === a.user_id)) {
        try {
          await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, carga, { TTL: 3600, urgency: "high" });
          enviados++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) caducados.add(d.endpoint);   // el dispositivo ya no existe
          else console.warn("Fallo al enviar", status, (e as Error).message);
        }
      }
    }
    if (caducados.size) await supabase.from("avisos_dispositivos").delete().in("endpoint", [...caducados]);
    return Response.json({ enviados, caducados: caducados.size });
  } catch (e) {
    console.error(e);
    return new Response(String((e as Error).message), { status: 500 });
  }
});
