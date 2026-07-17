import { prisma } from "@/lib/prisma";

// Unauthed health check for Docker/k8s liveness probes.
// ponytail: minimal — just DB up/down. No auth, no audit, no info leak beyond status.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      db: "up",
      ts: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      {
        status: "degraded",
        db: "down",
        ts: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
