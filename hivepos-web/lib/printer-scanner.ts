import net from "net";
import os from "os";

export interface DiscoveredPrinter {
  ip: string;
  port: number;
  latency: number;
}

function probePort(ip: string, port: number, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve(latency);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(null);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });

    socket.connect(port, ip);
  });
}

function getLocalSubnet(): { base: string } | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        const parts = iface.address.split(".");
        return { base: `${parts[0]}.${parts[1]}.${parts[2]}` };
      }
    }
  }
  return null;
}

export async function scanForPrinters(
  port = 9100,
  concurrency = 50,
  timeoutMs = 500
): Promise<DiscoveredPrinter[]> {
  const subnet = getLocalSubnet();
  if (!subnet) return [];

  const ips: string[] = [];
  for (let i = 1; i <= 254; i++) {
    ips.push(`${subnet.base}.${i}`);
  }

  const results: DiscoveredPrinter[] = [];

  for (let i = 0; i < ips.length; i += concurrency) {
    const batch = ips.slice(i, i + concurrency);
    const probes = await Promise.all(
      batch.map(async (ip) => {
        const latency = await probePort(ip, port, timeoutMs);
        if (latency !== null) return { ip, port, latency } satisfies DiscoveredPrinter;
        return null;
      })
    );
    for (const p of probes) {
      if (p) results.push(p);
    }
  }

  return results.sort((a, b) => a.latency - b.latency);
}

export async function testPrinterConnection(
  host: string,
  port: number
): Promise<{ ok: boolean; latency: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(3000);

    socket.on("connect", () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ ok: true, latency });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ ok: false, latency: 0, error: err.message });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, latency: 0, error: "Connection timed out" });
    });

    socket.connect(port, host);
  });
}
