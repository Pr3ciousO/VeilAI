"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { type ReactNode } from "react";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/**
 * Root providers. Privy is configured for a CUSTOM login UI (email + Google + X)
 * — the default modal is disabled; we drive auth with Privy hooks in components/auth.
 * An embedded Solana wallet is created for users without one so they can sign devnet txns.
 */
export function Providers({ children }: { children: ReactNode }) {
  if (!APP_ID) {
    // Render children without Privy when unconfigured so the UI still builds/runs in dev.
    return <>{children}</>;
  }
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ["email", "google", "twitter"],
        appearance: { theme: "dark", accentColor: "#4ade80" },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
