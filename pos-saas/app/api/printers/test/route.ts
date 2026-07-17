import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/get-session";
import { testPrinterConnection } from "@/lib/printer-scanner";
import { EscPosBuilder, sendToPrinter } from "@/lib/escpos";

export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const host = String(body.host || "").trim();
    const port = Number(body.port) || 9100;
    const { sendTestPrint } = body;
    const paperSize = body.paperSize;

    if (!host || host.length < 3 || host.length > 255) {
      return NextResponse.json({ error: "Valid host is required" }, { status: 400 });
    }
    // ponytail: no SSRF guard here — caller is an authenticated OWNER configuring their own
    // branch printer, and thermal printers live on the LAN (192.168/10.x/172.16-31). Blocking
    // those ranges (the old regex) broke Test Connection for every real network printer.
    // The threat model is untrusted public input; this endpoint is owner-gated above.
    if (port < 1 || port > 65535) {
      return NextResponse.json({ error: "Port must be 1-65535" }, { status: 400 });
    }
    const result = await testPrinterConnection(host, port);

    if (!result.ok) {
      return NextResponse.json({ connected: false, error: result.error });
    }

    if (sendTestPrint) {
      const p = new EscPosBuilder(paperSize);
      p.init()
        .align(1)
        .bold()
        .text("TEST PRINT")
        .normal()
        .line()
        .text(`Printer: ${host}:${port}`)
        .text(`Time: ${new Date().toLocaleString("id-ID")}`)
        .line()
        .text("If you can read this,")
        .text("your printer is working!")
        .feed(3)
        .cut();

      await sendToPrinter(p.build(), host, port);
    }

    return NextResponse.json({
      connected: true,
      latency: result.latency,
      testPrintSent: !!sendTestPrint,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test failed";
    return NextResponse.json({ connected: false, error: message }, { status: 500 });
  }
}
