import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import { NO_INDEX } from "@/lib/seo";
import { SignUpForm, SignUpFormWithParams } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create an account — NaijaScreen", robots: NO_INDEX };

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Join NaijaScreen"
      title="Create your account"
      description="Save films to watch later, keep track of what you've seen and share your reviews."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-gold hover:text-cream">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<SignUpForm />}>
        <SignUpFormWithParams />
      </Suspense>
    </AuthShell>
  );
}
