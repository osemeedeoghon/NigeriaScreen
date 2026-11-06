import type { Metadata } from "next";
import { Suspense } from "react";
import AccountSkeleton from "@/components/account/AccountSkeleton";
import { UpdatePasswordForm } from "@/components/auth/AuthForms";
import SetupNotice from "@/components/auth/SetupNotice";
import { requireUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Change password — NaijaScreen" };

export default function UpdatePasswordPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <div className="max-w-md">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-cream">Choose a new password</h1>
      <p className="mt-2 text-cream-muted">You&rsquo;ll use it the next time you sign in.</p>
      <div className="mt-8">
        <Suspense fallback={<AccountSkeleton label="Checking your session…" />}>
          <SignedInPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

async function SignedInPasswordForm() {
  await requireUser("/account/update-password");
  return <UpdatePasswordForm />;
}
