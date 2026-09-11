"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { PillButton } from "@/components/ui";

const links = [
  { href: "/agents", label: "Marketplace" },
  { href: "/dashboard", label: "My jobs" },
  { href: "/agents/new", label: "List an agent" },
];

export function AppNav() {
  const { user, logout, authenticated } = usePrivy();
  const pathname = usePathname();
  const email = user?.email?.address ?? user?.google?.email ?? user?.twitter?.username ?? "signed in";

  return (
    <nav className="sticky top-0 z-20 border-b border-ash bg-onyx/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-snow" />
            <span className="font-semibold tracking-tight text-snow">VeilAI</span>
          </Link>
          <div className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-pill px-3 py-1.5 text-sm transition-colors",
                  pathname === l.href ? "bg-smoke text-snow" : "text-fog hover:text-mist",
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        {authenticated && (
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-fog sm:block">{email}</span>
            <PillButton variant="outline" onClick={logout} className="px-4 py-1.5 text-xs">
              Sign out
            </PillButton>
          </div>
        )}
      </div>
    </nav>
  );
}
