import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * Shared social card. Every page gets the same frame — logo top-left, page
 * label, headline — so a shared link reads as VeilAI before it reads as a
 * page. Only the words change per route.
 */
export async function renderOgImage({
  eyebrow,
  title,
  footer = "Don't trust the agent. Verify it.",
}: {
  eyebrow: string;
  title: string;
  footer?: string;
}) {
  // Read at request/build time — ImageResponse can't resolve /public URLs.
  const logo = await readFile(
    join(process.cwd(), "public/images/logos/logo-full-white-nobg.png"),
  );
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#08090a",
          padding: 72,
          // Matches the app's verify-green accent bleeding in from the corner.
          backgroundImage:
            "radial-gradient(900px circle at 85% 15%, rgba(74,222,128,0.10), transparent 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="VeilAI" height={52} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 24,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#4ade80",
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              fontSize: 62,
              lineHeight: 1.1,
              color: "#f7f8f8",
              maxWidth: 960,
              letterSpacing: -1.5,
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#62666d",
          }}
        >
          <span>{footer}</span>
          <span>veilai</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
