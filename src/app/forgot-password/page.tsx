import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { NO_INDEX } from "@/lib/seo";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Reset your password — NaijaScreen", robots: NO_INDEX };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Password help"
      title="Reset your password"
      description="Enter the email you signed up with and we'll send you a link to choose a new password."
      footer={
        <Link href="/login" className="font-semibold text-gold hover:text-cream">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
