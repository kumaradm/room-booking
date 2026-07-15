import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const url = new URL(req.url);

  // 1. Handshake verification from Microsoft
  const validationToken = url.searchParams.get('validationToken');
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // 2. Handle incoming Outlook event triggers
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const notifications = body.value || [];

      for (const notification of notifications) {
        if (notification.changeType === 'created') {
          // When someone creates an event in Outlook, this block runs.
          // You will parse the data and insert it into your 'bookings' table.
          console.log("New booking event detected from Outlook!", notification);
        }
      }

      // Return a 202 quickly to let Microsoft know we received it
      return new Response(JSON.stringify({ received: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
})