import { checkSupabaseConnection } from "../../../lib/supabase";

export async function GET() {
  let connected = false;

  try {
    connected = await checkSupabaseConnection();
  } catch {
    // Keep connection and configuration details on the server.
  }

  return Response.json(
    { connected },
    {
      status: connected ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
