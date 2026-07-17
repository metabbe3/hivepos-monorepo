import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/get-session";
import { scanForPrinters } from "@/lib/printer-scanner";

export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const port = body.port || 9100;
    const printers = await scanForPrinters(port);
    return NextResponse.json({ printers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
