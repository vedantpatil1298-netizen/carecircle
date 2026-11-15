import Link from "next/link";
import { AdherencePanel, RequestsPanel, TodayPanel } from "../../components/dashboard-panels";
import { appointmentDisplay, upcomingAppointments } from "../../lib/appointments";
import { requireDashboardSession } from "../../lib/dashboard";
import { medicationOverview } from "../../lib/medications";

export default async function DashboardPage() {
  const session = await requireDashboardSession();
  const [overview, appointments] = await Promise.all([
    medicationOverview(session.profileId, session.role),
    upcomingAppointments(session.profileId),
  ]);
  if (!overview) return <p className="care-empty">The care log is temporarily unavailable. Refresh to try again.</p>;
  const nextVisit = appointments?.[0];

  return (
    <>
      <h2 className="dashboard-page-title">Care overview</h2>
      <div className="care-grid">
        <div className="care-column">
          <TodayPanel overview={overview} role={session.role} />
          <RequestsPanel overview={overview} role={session.role} />
        </div>
        <div className="care-column">
          <AdherencePanel overview={overview} />
          <section className="care-section next-visit">
            <h2>Next appointment</h2>
            {nextVisit ? (
              <><strong>{nextVisit.doctor_name}</strong><p>{appointmentDisplay(nextVisit.scheduled_at)}</p></>
            ) : <p>{appointments === null ? "Appointments are temporarily unavailable." : "No upcoming visits have been added."}</p>}
            <Link href="/dashboard/appointments">View appointments</Link>
          </section>
        </div>
      </div>
    </>
  );
}
