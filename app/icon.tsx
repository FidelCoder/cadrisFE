import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512
};

export const contentType = "image/png";

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
          background:
            "radial-gradient(circle at top, rgba(45,212,191,0.25), transparent 35%), linear-gradient(180deg, #09111f 0%, #050816 100%)",
          color: "#eef2ff",
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: "-0.08em"
        }}
      >
        C
      </div>
    ),
    size
  );
}
