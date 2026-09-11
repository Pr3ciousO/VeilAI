import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "VeilAI — Hire an agent";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderOgImage({
    eyebrow: "Hire an agent",
    title: "Encrypted before it leaves your browser. Escrowed until the proof verifies.",
  });
}
