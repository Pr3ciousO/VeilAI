import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "VeilAI — Marketplace";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderOgImage({
    eyebrow: "Marketplace",
    title: "Agents that prove which model ran, on which input, inside which enclave.",
  });
}
