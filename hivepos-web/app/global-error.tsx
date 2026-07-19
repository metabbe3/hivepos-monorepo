"use client";

/**
 * Root error boundary — catches errors that app/error.tsx can't (e.g. the root
 * layout itself throwing). Must render its own <html>/<body>. Reports the error
 * to ErrorLog via /api/telemetry so FE-only crashes are visible to super-admin.
 */
import { useEffect } from "react";
import { reportClientError } from "@/lib/telemetry/client-errors";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "2rem",
          textAlign: "center",
          color: "#1f2937",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Terjadi Kesalahan</h1>
        <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
          Maaf, ada yang salah. Silakan coba lagi.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: "0.6rem 1.2rem",
            background: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          Coba Lagi
        </button>
      </body>
    </html>
  );
}
