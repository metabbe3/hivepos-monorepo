import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon. More padding than favicon — iOS rounds corners + adds gloss
// (we suppress gloss via the PNG being pre-rounded).
export default function AppleIcon() {
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
        }}
      >
        <svg width="110" height="110" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
