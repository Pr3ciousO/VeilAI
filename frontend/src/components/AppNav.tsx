"use client";

import Link from "next/link";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { PillButton } from "@/components/ui";

/** Marketplace is public; everything else needs a session. */
const publicLinks = [{ href: "/agents", label: "Marketplace" }];
const privateLinks = [
  { href: "/dashboard", label: "My jobs" },
  { href: "/agents/new", label: "List an agent" },
];

export function AppNav() {
  const { user, logout, authenticated, ready } = usePrivy();
  const pathname = usePathname();
  const email =
    user?.email?.address ?? user?.google?.email ?? user?.twitter?.username ?? "signed in";

  const links = authenticated ? [...publicLinks, ...privateLinks] : publicLinks;

  return (
    <nav className="sticky top-0 z-20 border-b border-ash bg-onyx/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          {/* Home for a visitor is the landing page, not a page they can't see. */}
          <Link href={authenticated ? "/dashboard" : "/"} className="flex items-center">
            <Image
              src="/images/logos/logo-full-white-nobg.png"
              alt="VeilAI"
              width={112}
              height={30}
              priority
              className="h-7 w-auto"
            />
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
        {ready && authenticated ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-fog sm:block">{email}</span>
            <PillButton variant="outline" onClick={logout} className="px-4 py-1.5 text-xs">
              Sign out
            </PillButton>
          </div>
        ) : ready ? (
          <Link href="/">
            <PillButton className="px-4 py-1.5 text-xs">Sign in</PillButton>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
