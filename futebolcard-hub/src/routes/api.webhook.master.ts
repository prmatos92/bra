import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/firebase";
import { getOrder, issueTickets } from "@/lib/orders";

export const Route = createFileRoute("/api/webhook/master")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: Record<string, unknown>;
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("Bad Request", { status: 400 });
        }

        const transactionId = payload.id as string | undefined;
        const status = payload.status as string | undefined;

        if (status === "paid" && transactionId) {
          const sb = getSupabase();

          const { data: orderRow } = await sb
            .from("orders")
            .select("id, status")
            .eq("pix_transaction_id", transactionId)
            .single();

          if (orderRow && (orderRow as { status: string }).status === "pending") {
            const { error } = await sb
              .from("orders")
              .update({ status: "paid" })
              .eq("id", (orderRow as { id: string }).id)
              .eq("status", "pending");

            if (!error) {
              const order = await getOrder((orderRow as { id: string }).id);
              if (order) {
                await issueTickets(order).catch(() => {
                  // log but don't fail the webhook response
                });
              }
            }
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
