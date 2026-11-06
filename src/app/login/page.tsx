import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import { NO_INDEX } from "@/lib/seo";
import { LoginForm, LoginFormWithParams } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Sign in — NaijaScreen", robots: NO_INDEX };

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to NaijaScreen"
      description="Pick up your watchlist, the films you've seen and your reviews."
      footer={
        <>
          New to NaijaScreen?{" "}
          <Link href="/signup" className="font-semibold text-gold hover:text-cream">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithParams />
      </Suspense>
    </AuthShell>
  );
}
