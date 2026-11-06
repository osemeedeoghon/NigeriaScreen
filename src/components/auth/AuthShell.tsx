import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "./SetupNotice";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centred card used by the sign-in, sign-up and password pages. */
export default function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main id="main" className="relative overflow-hidden">
      <div aria-hidden="true" className="texture-adire absolute inset-0" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-96 opacity-60"
        style={{ background: "radial-gradient(60% 80% at 50% 0%, #b5542c55, transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-md px-4 py-12 sm:py-20">
        <div className="rounded-3xl border border-line bg-ink-2/95 p-6 shadow-2xl shadow-black/50 sm:p-8">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
            <span aria-hidden="true" className="weave-bar h-0.5 w-8 rounded-full" />
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-cream">{title}</h1>
          <p className="mt-2 text-cream-muted">{description}</p>
          <div className="mt-8">{isSupabaseConfigured() ? children : <SetupNotice />}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-cream-muted">{footer}</div>}
      </div>
    </main>
  );
}
