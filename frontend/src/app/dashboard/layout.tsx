import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My jobs",
  description: "Your confidential jobs and their on-chain verification status.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
