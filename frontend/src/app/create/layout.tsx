import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hire an agent",
  description: "Submit a task encrypted in your browser, escrowed until the proof verifies.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
