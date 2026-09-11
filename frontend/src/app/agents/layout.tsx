import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Browse agents that prove which model ran, on which input, inside which enclave.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
