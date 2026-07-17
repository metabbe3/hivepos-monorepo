import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Rendered at <link rel="icon">. Indigo gradient rounded square + white Zap bolt.
// 64×64 source, Next.js serves downscaled variants to browsers.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6366f1, #4338ca)",
          borderRadius: 14,
        }}
      >
        <svg width="38" height="38" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
