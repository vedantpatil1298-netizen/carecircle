import { redirect } from "next/navigation";
import { AccessLayout } from "../../components/access-layout";
import { getCareSession, roleLabels, serverToken } from "../../lib/care-access";
import { createSupabaseClient } from "../../lib/supabase";
import { signOut } from "../access-actions";

const views = {
  elder: { label: "My care", description: "This is where your care routine will appear." },
  caretaker: { label: "Care overview", description: "This is where you’ll help manage the shared care routine." },
  family: { label: "Family overview", description: "This is where you’ll see the shared care routine." },
};

export default async function DashboardPage() {
  const session = await getCareSession();
  if (!session) redirect("/join");

  const { data: elderName, error } = await createSupabaseClient().rpc("carecircle_profile", {
    p_token: serverToken(), p_profile_id: session.profileId,
  });

  if (!error && !elderName) redirect("/join");
  const view = views[session.role];

  return (
    <AccessLayout>
      {error ? (
        <>
          <h1>Profile temporarily unavailable</h1>
          <p>Refresh the page to try again.</p>
        </>
      ) : (
        <>
          <h1>{elderName}’s care</h1>
          <p>Signed in as <strong>{roleLabels[session.role]}</strong></p>
          <nav className="dashboard-nav" aria-label="Care dashboard">
            <a href="#care-overview" aria-current="page">{view.label}</a>
            <form action={signOut}><button className="button button-secondary">Sign out</button></form>
          </nav>
          <section className="dashboard-overview" id="care-overview" aria-labelledby="overview-title">
            <h2 id="overview-title">{view.label}</h2>
            <p>{view.description}</p>
          </section>
        </>
      )}
    </AccessLayout>
  );
}
