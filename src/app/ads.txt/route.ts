import { ADSENSE_CLIENT } from "@/lib/adsense";

export function GET() {
  if (!ADSENSE_CLIENT?.startsWith("ca-pub-")) {
    return new Response("Not Found", { status: 404 });
  }

  const publisherId = ADSENSE_CLIENT.replace(/^ca-/, "");

  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
