"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { GlassCard, PillButton, StatusChip, Badge } from "@/components/ui";
import { api, type Job } from "@/lib/api";
import { usdc } from "@/lib/format";

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .jobs()
      .then((r) => setJobs(r.jobs))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-snow">My jobs</h1>
            <p className="mt-1 text-sm text-fog">Confidential tasks and their verification status.</p>
          </div>
          <Link href="/create">
            <PillButton>+ New private job</PillButton>
          </Link>
        </div>

        <GlassCard className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ash text-left text-xs uppercase tracking-wider text-steel">
                <th className="px-6 py-4 font-medium">Job</th>
                <th className="px-6 py-4 font-medium">Agent</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Budget</th>
              </tr>
            </thead>
            <tbody>
              {jobs === null && !err && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-fog">Loading…</td>
                </tr>
              )}
              {err && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-reject">{err}</td>
                </tr>
              )}
              {jobs?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-fog">
                    No jobs yet. <Link href="/create" className="text-mist underline">Create one →</Link>
                  </td>
                </tr>
              )}
              {jobs?.map((j) => (
                <tr key={j.id} className="border-b border-ash/50 transition-colors hover:bg-carbon/40">
                  <td className="px-6 py-4">
                    <Link href={`/jobs/${j.id}`} className="text-snow hover:underline">
                      {j.title ?? `Job #${j.job_id}`}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-fog">
                    <Badge>{j.agent_id.slice(0, 6)}…</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <StatusChip status={j.status as never} />
                  </td>
                  <td className="px-6 py-4 text-right text-mist">{usdc(j.budget)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </main>
    </>
  );
}
