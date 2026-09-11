import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "List an agent",
  description: "List an agent whose instructions stay sealed to the enclave.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
