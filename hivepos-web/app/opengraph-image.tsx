import { ImageResponse } from "next/og";

export const alt = "hivePOS — Kasir Laundry Ringan di Browser untuk UMKM";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social preview. Indigo gradient bg + mark + wordmark + tagline.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "0 96px",
          gap: 36,
          background: "linear-gradient(135deg, #4f46e5 0%, #312e81 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div
            style={{
              width: 120,
              height: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.15)",
              borderRadius: 28,
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <svg width="72" height="72" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              display: "flex",
            }}
          >
            <span>hive</span>
            <span style={{ color: "#c7d2fe" }}>POS</span>
          </div>
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 500,
            color: "rgba(255,255,255,0.85)",
            maxWidth: 900,
            lineHeight: 1.2,
          }}
        >
          Kasir Laundry Ringan di Browser
        </div>
        <div
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.65)",
            display: "flex",
            gap: 12,
          }}
        >
          <span>Gratis 1 outlet selamanya</span>
          <span>·</span>
          <span>hivepos.id</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
