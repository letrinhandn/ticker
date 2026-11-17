import { routePartykitRequest } from "partyserver";
import type { Env } from "./types";
import { PlotRoom } from "./room";

// Named export required for wrangler durable_objects.class_name = "PlotRoom".
export { PlotRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("PlotParty realtime OK", { status: 200 });
    }
    return (
      (await routePartykitRequest(request, env as never)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
