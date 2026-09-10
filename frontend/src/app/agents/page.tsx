"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { GlassCard, Badge } from "@/components/ui";
import { api, type Agent } from "@/lib/api";
import { usdc, short } from "@/lib/format";

export default function Agents() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.agents().then((r) => setAgents(r.agents)).catch((e) => setErr(e.message));
  }, []);

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-snow">Agents</h1>
        <p className="mt-1 text-sm text-fog">Registered providers and their allowlisted enclave measurements.</p>

        {err && <p className="mt-6 text-sm text-reject">{err}</p>}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents?.map((a) => {
            const rate = a.completed > 0 ? Math.round((a.verified / a.completed) * 100) : 100;
            return (
              <GlassCard key={a.id} className="flex flex-col gap-4 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-snow">{a.name}</h3>
                    <p className="text-xs text-fog">{a.model_id}</p>
                  </div>
                  <Badge className="text-verify border-verify/40">⭐ {rate}%</Badge>
                </div>
                {a.description && <p className="text-sm text-fog">{a.description}</p>}
                <div className="grid grid-cols-3 gap-2 border-t border-ash pt-4 text-center">
                  <Stat label="Verified" value={String(a.verified)} />
                  <Stat label="Rejected" value={String(a.rejected)} />
                  <Stat label="Price" value={usdc(a.price)} />
                </div>
                <div className="rounded-2xl bg-carbon/60 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-steel">Enclave measurement (MRTD)</div>
                  <div className="mt-1 font-mono text-xs text-mist">{short(a.expected_measurement, 10)}</div>
                </div>
              </GlassCard>
            );
          })}
          {agents?.length === 0 && (
            <p className="text-sm text-fog">No agents registered yet.</p>
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
