import Link from "next/link";
import { AccessLayout } from "../../components/access-layout";
import { JoinProfileForm, PasswordSignInForm } from "../../components/access-forms";

export default async function JoinProfilePage({ searchParams }: { searchParams: Promise<{ method?: string }> }) {
  const { method } = await searchParams;
  const legacy = method === "passcode";

  return (
    <AccessLayout>
      <h1>{legacy ? "Join with a passcode" : "Sign in to CareCircle"}</h1>
      <p>{legacy ? "Enter the passcode for a profile created before email sign-in." : "Use the email and password for the role you want to open."}</p>
      {legacy ? <JoinProfileForm /> : <PasswordSignInForm />}
      <p className="alternate-link">
        {legacy ? <Link href="/join">Sign in with email</Link> : <Link href="/join?method=passcode">Use an existing passcode</Link>}
      </p>
      <p className="alternate-link"><Link href="/create">Create a new care profile</Link></p>
    </AccessLayout>
  );
}
