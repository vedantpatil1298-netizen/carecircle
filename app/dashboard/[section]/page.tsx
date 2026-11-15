import { notFound } from "next/navigation";
import { InviteMemberForm } from "../../../components/access-forms";
import { CareChat } from "../../../components/care-chat";
import { AppointmentsPanel, HistoryPanel, MedicationPanel, RequestsPanel } from "../../../components/dashboard-panels";
import { accountRoster } from "../../../lib/account-security";
import { upcomingAppointments } from "../../../lib/appointments";
import { roleLabels } from "../../../lib/care-access";
import { requireDashboardSession } from "../../../lib/dashboard";
import { medicationOverview } from "../../../lib/medications";

export default async function DashboardSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const session = await requireDashboardSession();

  switch (section) {
    case "medications":
    case "history": {
      const overview = await medicationOverview(session.profileId, session.role);
      if (!overview) return <p className="care-empty">The care log is temporarily unavailable.</p>;
      return section === "history" ? <HistoryPanel overview={overview} /> : (
        <div className="care-column">
          <MedicationPanel overview={overview} role={session.role} />
          <RequestsPanel overview={overview} role={session.role} />
        </div>
      );
    }
    case "appointments":
      return <AppointmentsPanel appointments={await upcomingAppointments(session.profileId)} role={session.role} />;
    case "assistant":
      if (session.role === "elder") notFound();
      return <CareChat />;
    case "account": {
      const roster = session.accountId ? await accountRoster(session.profileId, session.accountId) : null;
      return (
        <section className="care-section" aria-labelledby="accounts-title">
          <h2 id="accounts-title">CareCircle accounts</h2>
          {roster ? (
            <>
              <p className="care-muted">Use Switch account to sign in with another member’s own credentials.</p>
              <ul className="care-list account-list">
                {roster.members.map(({ id, role, verified }) => (
                  <li key={id} className="dose-row">
                    <strong>{roleLabels[role]}</strong>
                    <p className="care-muted">{verified ? "Email verified" : "Awaiting email verification"}</p>
                    {roster.can_invite && !verified && <InviteMemberForm id={id} />}
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="care-muted">{session.accountId ? "The member list is temporarily unavailable." : "This profile uses role passcodes. Switch accounts to sign in with another member’s passcode."}</p>}
        </section>
      );
    }
    default:
      notFound();
  }
}
