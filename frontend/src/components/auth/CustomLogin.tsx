"use client";

import { useState } from "react";
import { useLoginWithEmail, useLoginWithOAuth } from "@privy-io/react-auth";
import { HugeiconsIcon } from "@hugeicons/react";
import { GoogleIcon, NewTwitterIcon, Mail01Icon } from "@hugeicons/core-free-icons";
import { motion, AnimatePresence } from "framer-motion";
import { PillButton, PillInput } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Custom Privy login — email code + Google + X. NOT the default Privy modal.
 * Renders inside our glass/pill design system.
 */
export function CustomLogin() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { initOAuth } = useLoginWithOAuth();

  async function onSendCode() {
    setErr(null);
    setBusy(true);
    try {
      await sendCode({ email });
      setStage("code");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    setErr(null);
    setBusy(true);
    try {
      await loginWithCode({ code });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "twitter") {
    setErr(null);
    try {
      await initOAuth({ provider });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "OAuth failed");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="wait">
        {stage === "email" ? (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-3"
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pewter">
                <HugeiconsIcon icon={Mail01Icon} size={18} />
              </span>
              <PillInput
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && email && onSendCode()}
                className="pl-11"
              />
            </div>
            <PillButton onClick={onSendCode} disabled={!email || busy}>
              {busy ? "Sending…" : "Continue with email"}
            </PillButton>
          </motion.div>
        ) : (
          <motion.div
            key="code"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-3"
          >
            <p className="text-xs text-fog px-1">
              Enter the code sent to <span className="text-mist">{email}</span>
            </p>
            <PillInput
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && code && onVerify()}
            />
            <PillButton onClick={onVerify} disabled={!code || busy}>
              {busy ? "Verifying…" : "Verify & sign in"}
            </PillButton>
            <button
              className="text-xs text-pewter hover:text-fog transition-colors"
              onClick={() => setStage("email")}
            >
              ← Use a different email
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-ash" />
        <span className="text-[11px] uppercase tracking-widest text-steel">or</span>
        <div className="h-px flex-1 bg-ash" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SocialButton onClick={() => oauth("google")} icon={GoogleIcon} label="Google" />
        <SocialButton onClick={() => oauth("twitter")} icon={NewTwitterIcon} label="X" />
      </div>

      {err && <p className="text-xs text-reject px-1">{err}</p>}
    </div>
  );
}

function SocialButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: typeof GoogleIcon;
  label: string;
}) {
  return (
    <PillButton variant="ghost" onClick={onClick} className={cn("w-full")}>
      <HugeiconsIcon icon={icon} size={18} />
      {label}
    </PillButton>
  );
}
