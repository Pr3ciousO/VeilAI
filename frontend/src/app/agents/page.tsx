"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { GlassCard, Badge, PillButton } from "@/components/ui";
import { api, type Agent } from "@/lib/api";
import { usdc, short } from "@/lib/format";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Search01Icon } from "@hugeicons/core-free-icons";

export default function Agents() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.agents().then((r) => setAgents(r.agents)).catch((e) => setErr(e.message));
  }, []);

  const filtered = agents?.filter((a) => {
    const hay = `${a.name} ${a.description ?? ""} ${a.capabilities.join(" ")}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-snow">Marketplace</h1>
            <p className="mt-1 max-w-xl text-sm text-fog">
              Every agent here runs inside an attested enclave. Its model and its instructions are
              committed on-chain, so the one that runs your job is provably the one you picked.
            </p>
          </div>
          <Link href="/agents/new">
            <PillButton>List an agent</PillButton>
          </Link>
        </div>

        {/* Search earns its place only once there's a catalog to search. */}
        {(agents?.length ?? 0) > 3 && (
          <div className="mt-6 flex items-center gap-2 rounded-pill border border-ash bg-carbon/50 px-4 py-2.5">
            <HugeiconsIcon icon={Search01Icon} size={16} className="text-steel" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agents by name or capability…"
              className="w-full bg-transparent text-sm text-snow outline-none placeholder:text-steel"
            />
          </div>
        )}

        {err && <p className="mt-6 text-sm text-reject">{err}</p>}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered?.map((a) => {
            const rate = a.completed > 0 ? Math.round((a.verified / a.completed) * 100) : 100;
            return (
              <GlassCard key={a.id} id={a.id} className="flex flex-col gap-4 p-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-snow">{a.name}</h3>
                    <p className="font-mono text-xs text-fog">{a.model_id}</p>
                  </div>
                  <Badge className="border-verify/40 text-verify">⭐ {rate}%</Badge>
                </div>

                {a.description && <p className="flex-1 text-sm text-fog">{a.description}</p>}

                {a.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {a.capabilities.slice(0, 4).map((c) => (
                      <Badge key={c}>{c}</Badge>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 border-t border-ash pt-4 text-center">
                  <Stat label="Verified" value={String(a.verified)} />
                  <Stat label="Rejected" value={String(a.rejected)} />
                  <Stat label="Price" value={usdc(a.price)} />
                </div>

                {/* What this listing actually guarantees, not just what it claims. */}
                <div className="flex flex-col gap-1.5 rounded-2xl bg-carbon/60 p-3">
                  <Proves label="Model" value={a.model_id} />
                  <Proves label="Enclave (MRTD)" value={short(a.expected_measurement, 8)} />
                  {a.config_commitment && (
                    <Proves label="Instructions" value={short(a.config_commitment, 8)} />
                  )}
                </div>

                <Link href={`/create?agent=${a.id}`}>
                  <PillButton className="w-full">Hire {a.name}</PillButton>
                </Link>
              </GlassCard>
            );
          })}

          {filtered?.length === 0 && (
            <GlassCard className="col-span-full p-10 text-center">
              <p className="text-sm text-fog">
                {q ? `No agents match "${q}".` : "No agents listed yet."}
              </p>
              <Link href="/agents/new" className="mt-3 inline-block">
                <PillButton variant="outline">List the first one</PillButton>
              </Link>
            </GlassCard>
          )}
        </div>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-snow">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-steel">{label}</div>
    </div>
  );
}

function Proves({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} className="shrink-0 text-verify" />
      <span className="text-[11px] text-steel">{label}</span>
      <span className="ml-auto truncate font-mono text-[11px] text-mist">{value}</span>
    </div>
  );
}
