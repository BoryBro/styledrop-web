import { NextResponse } from "next/server";
import { loadStyleControls } from "@/lib/style-controls.server";

export async function GET() {
  const controls = await loadStyleControls();
  return NextResponse.json({ controls });
}
