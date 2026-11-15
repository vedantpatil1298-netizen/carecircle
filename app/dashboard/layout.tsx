import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AccessLayout } from "../../components/access-layout";
import { DashboardNav } from "../../components/dashboard-nav";
import { roleLabels } from "../../lib/care-access";
import { dashboardProfile, requireDashboardSession } from "../../lib/dashboard";
import { signOut, switchAccount } from "../access-actions";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireDashboardSession();
  const profile = await dashboardProfile(session.profileId);
  if (!profile.unavailable && !profile.name) redirect("/join");

  return (
    <AccessLayout dashboard>
      <div className="dashboard-header">
        <div>
          <h1>{profile.name ? profile.name + "’s care" : "Care dashboard"}</h1>
          <p className="dashboard-role">Signed in as <strong>{roleLabels[session.role]}</strong></p>
        </div>
        <div className="dashboard-actions">
          <form action={switchAccount}><button className="button button-secondary">Switch account</button></form>
          <form action={signOut}><button className="button button-secondary">Sign out</button></form>
        </div>
      </div>
      <DashboardNav hasAssistant={session.role !== "elder"} />
      {profile.unavailable ? <p className="care-empty">This profile is temporarily unavailable. Refresh and try again.</p> : children}
    </AccessLayout>
  );
}
