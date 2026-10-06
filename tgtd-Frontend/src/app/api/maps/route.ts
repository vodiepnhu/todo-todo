import { NextResponse } from "next/server";
import { searchPlace, getRouteEta, safeMapsRedirect } from "@togo-todo/agent";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "search") {
    const result = await searchPlace(body.query ?? "");
    return NextResponse.json(result);
  }
  if (body.action === "route") {
    const result = await getRouteEta({
      origin: body.origin,
      destination: body.destination,
      mode: body.mode,
    });
    return NextResponse.json(result);
  }
  if (body.action === "redirect") {
    const safe = safeMapsRedirect(body.url ?? "");
    if (!safe) {
      return NextResponse.json({ error: "Untrusted URL" }, { status: 400 });
    }
    return NextResponse.json({ url: safe });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
