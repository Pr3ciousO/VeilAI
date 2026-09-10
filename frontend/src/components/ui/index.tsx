"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { type ReactNode, forwardRef } from "react";
import { cn } from "@/lib/cn";

/* ─── GlassCard ────────────────────────────────────────────────────────── */
export function GlassCard({
  children,
  className,
  raised,
  ...rest
}: { children: ReactNode; className?: string; raised?: boolean } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(raised ? "glass-raised" : "glass", "rounded-3xl", className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ─── PillButton ───────────────────────────────────────────────────────── */
type PillVariant = "primary" | "ghost" | "outline";
const pillVariants: Record<PillVariant, string> = {
  primary: "bg-snow text-void hover:bg-chalk border border-snow",
  ghost: "bg-smoke/60 text-mist hover:bg-iron border border-ash",
  outline: "bg-transparent text-mist hover:bg-carbon border border-ferrite",
};

export const PillButton = forwardRef<
  HTMLButtonElement,
  { variant?: PillVariant; children: ReactNode } & HTMLMotionProps<"button">
>(function PillButton({ variant = "primary", children, className, ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "rounded-pill px-5 py-2.5 text-sm font-medium tracking-tight",
        "disabled:opacity-40 disabled:pointer-events-none transition-colors",
        "inline-flex items-center justify-center gap-2",
        pillVariants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
});

/* ─── PillInput ────────────────────────────────────────────────────────── */
export const PillInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function PillInput({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-pill bg-carbon/80 border border-ash px-5 py-3 text-sm text-snow",
        "placeholder:text-pewter outline-none transition-colors",
        "focus:border-ferrite focus:bg-carbon",
        className,
      )}
      {...rest}
    />
  );
});

/* ─── TextArea (glass, rounded-2xl) ────────────────────────────────────── */
export const GlassTextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function GlassTextArea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-2xl bg-carbon/80 border border-ash px-5 py-4 text-sm text-snow",
        "placeholder:text-pewter outline-none transition-colors resize-none",
        "focus:border-ferrite focus:bg-carbon",
        className,
      )}
      {...rest}
    />
  );
});

/* ─── StatusChip ───────────────────────────────────────────────────────── */
type Status = "Created" | "Escrowed" | "Executing" | "Verified" | "Rejected" | "Settled";
const statusStyles: Record<Status, string> = {
  Created: "text-fog border-ash",
  Escrowed: "text-mist border-ferrite",
  Executing: "text-pending border-pending/40",
  Verified: "text-verify border-verify/40",
  Rejected: "text-reject border-reject/40",
  Settled: "text-verify border-verify/50 bg-verify/10",
};

export function StatusChip({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium",
        statusStyles[status] ?? "text-fog border-ash",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

/* ─── Badge ────────────────────────────────────────────────────────────── */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border border-ash bg-smoke/50 px-3 py-1 text-xs text-fog",
        className,
      )}
    >
      {children}
    </span>
  );
}
