"use client";

import { useState, useTransition } from "react";
import type { AdminResult } from "@/lib/viewing/actions";
import { Spinner } from "../forms/FormControls";

interface AdminActionButtonProps {
  label: string;
  /** Server Action bound to its arguments. */
  run: () => Promise<AdminResult>;
  /** When set, the first press asks for confirmation with this text. */
  confirm?: string;
  tone?: "default" | "danger" | "positive";
}

const TONES = {
  default: "border-line text-cream hover:border-gold",
  danger: "border-terracotta/60 text-terracotta hover:bg-terracotta hover:text-ink",
  positive: "border-palm/60 text-palm hover:bg-palm hover:text-ink",
};

/** A small admin action with an optional confirm step and an announced result. */
export default function AdminActionButton({ label, run, confirm, tone = "default" }: AdminActionButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);

  const go = () =>
    start(async () => {
      setResult(await run());
      setConfirming(false);
    });

  const base = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60";

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {confirming ? (
        <span role="group" aria-label={`Confirm: ${label}`} className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-surface px-3 py-2">
          <span className="text-xs text-cream">{confirm}</span>
          <button type="button" onClick={go} disabled={pending} className={`${base} ${TONES[tone]}`}>
            {pending && <Spinner />}
            {pending ? "Working…" : `Yes, ${label.toLowerCase()}`}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="text-xs font-semibold text-cream-muted hover:text-cream">
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => (confirm ? setConfirming(true) : go())} disabled={pending} className={`${base} ${TONES[tone]}`}>
          {pending && <Spinner />}
          {label}
        </button>
      )}
      {result && (
        <span role={result.ok ? "status" : "alert"} className={`text-xs ${result.ok ? "text-palm" : "text-terracotta"}`}>
          {result.message}
        </span>
      )}
    </span>
  );
}
