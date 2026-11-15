import Link from "next/link";
import { AccessLayout } from "../../components/access-layout";
import { JoinProfileForm } from "../../components/access-forms";

export default function JoinProfilePage() {
  return (
    <AccessLayout>
      <h1>Join with a passcode</h1>
      <p>Use the passcode that the person who set up your care profile shared with you.</p>
      <JoinProfileForm />
      <p className="alternate-link"><Link href="/create">Create a new care profile</Link></p>
    </AccessLayout>
  );
}
