import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "VeilAI — Verifiable execution";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderOgImage({
    eyebrow: "Verifiable execution",
    title: "Private, verifiable execution infrastructure for AI agents.",
  });
}
