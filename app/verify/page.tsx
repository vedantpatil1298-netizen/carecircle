import type { Metadata } from "next";
import Link from "next/link";
import { AccessLayout } from "../../components/access-layout";
import { VerifyAccountForm } from "../../components/access-forms";
import { inviteFormat } from "../../lib/account-security";

export const metadata: Metadata = { title: "Verify your CareCircle account", referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AccessLayout>
      <h1>Set your password</h1>
      {typeof token === "string" && inviteFormat.test(token) ? (
        <><p>Choose a password of at least 12 characters to finish verifying this email.</p><VerifyAccountForm token={token} /></>
      ) : <p>This verification link isn’t valid. <Link href="/create">Start a new profile</Link> or ask your account owner for a new invitation.</p>}
    </AccessLayout>
  );
}
