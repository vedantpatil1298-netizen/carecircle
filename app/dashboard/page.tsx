import { redirect } from "next/navigation";
import { AppointmentForm } from "../../components/appointment-form";
import { appointmentDisplay, appointmentInput, upcomingAppointments } from "../../lib/appointments";
import { AccessLayout } from "../../components/access-layout";
import { CareChat } from "../../components/care-chat";
import { DoseButtons, MedicationForm, RemoveMedication, ReviewButtons } from "../../components/medication-forms";
import { getCareSession, roleLabels, serverToken } from "../../lib/care-access";
import { adherence, careTimeZone, dateInCareZone, doseTime, medicationOverview, statusLabel, weekdays } from "../../lib/medications";
import { createSupabaseClient } from "../../lib/supabase";
import { signOut } from "../access-actions";

const overviewTitle = { elder: "My care", caretaker: "Care overview", family: "Family overview" };

export default async function DashboardPage() {
  const session = await getCareSession();
  if (!session) redirect("/join");

  const [{ data: elderName, error }, overview, appointments] = await Promise.all([
    createSupabaseClient().rpc("carecircle_profile", { p_token: serverToken(), p_profile_id: session.profileId }),
    medicationOverview(session.profileId, session.role),
    upcomingAppointments(session.profileId),
  ]);

  if (!error && !elderName) redirect("/join");
  if (error || !overview) {
    return <AccessLayout><h1>Care profile unavailable</h1><p>Refresh the page to try again.</p></AccessLayout>;
  }

  const today = overview.doses.filter((dose) => dose.is_today);
  const week = adherence(overview.doses);
  const canManage = session.role !== "family";
  const recentDoses = overview.doses.filter((dose) => dose.status !== "upcoming").reverse();
  const historyDate = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: careTimeZone });
  const caretaker = session.role === "caretaker";
  const hasChat = session.role !== "elder";

  return (
    <AccessLayout dashboard>
      <h1>{elderName}’s care</h1>
      <p>Signed in as <strong>{roleLabels[session.role]}</strong></p>
      <nav className="dashboard-nav" aria-label="Care dashboard">
        <div className="dashboard-links">
          <a href="#today">{overviewTitle[session.role]}</a>
          <a href="#schedule">Medication schedules</a>
          <a href="#appointments">Appointments</a>
          <a href="#dose-history">Dose history</a>
          {hasChat && <a href="#assistant">Care assistant</a>}
        </div>
        <form action={signOut}><button className="button button-secondary">Sign out</button></form>
      </nav>
      <div className="care-grid">
        <div className="care-column">
          <section className="care-section" id="today" aria-labelledby="today-title">
            <h2 id="today-title">Today</h2>
            <p className="care-muted">Scheduled times are in IST.</p>
            {today.length === 0 ? <p className="care-empty">No doses are scheduled for today.</p> : (
              <ol className="care-list">
                {today.map((dose) => (
                  <li key={`${dose.medication_id}-${dose.scheduled_for}`} className="dose-row">
                    <div className="dose-heading">
                      <time dateTime={dose.scheduled_for}>{doseTime(dose.scheduled_for)}</time>
                      <span className={`dose-status dose-${dose.status}`}>{statusLabel(dose.status)}</span>
                    </div>
                    <strong>{dose.name}</strong> <span>{dose.dosage}</span>
                    {dose.instructions && <p className="care-muted">{dose.instructions}</p>}
                    {canManage && (dose.status === "unconfirmed" || dose.status === "pending" || dose.status === "missed") && <DoseButtons dose={dose} />}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="care-section" id="schedule" aria-labelledby="schedule-title">
            <h2 id="schedule-title">Medication schedules</h2>
            {canManage && <MedicationForm today={dateInCareZone()} request={caretaker} />}
            {overview.medications.length === 0 ? <p className="care-empty">There are no active schedules yet.</p> : (
              <ul className="care-list">
                {overview.medications.map((medication) => (
                  <li key={medication.id} className="dose-row">
                    <strong>{medication.name}</strong> <span>{medication.dosage}</span>
                    <p className="care-muted">{medication.times.map((time) => time.slice(0, 5)).join(", ")} IST · {medication.days.length === 7 ? "Every day" : medication.days.map((day) => weekdays[day]).join(", ")}</p>
                    {canManage && (
                      <div className="schedule-actions">
                        <MedicationForm medication={medication} today={dateInCareZone()} request={caretaker} />
                        <RemoveMedication medication={medication} request={caretaker} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="care-section" id="appointments" aria-labelledby="appointments-title">
            <h2 id="appointments-title">Upcoming appointments</h2>
            {appointments === null ? <p className="care-empty">Appointments are temporarily unavailable. Refresh to try again.</p> : (
              <>
                <AppointmentForm />
                {appointments.length === 0 ? <p className="care-empty">No upcoming visits have been added.</p> : (
                  <ol className="care-list">
                    {appointments.map((appointment) => (
                      <li key={appointment.id} className="dose-row">
                        <strong>{appointment.doctor_name}</strong>
                        <p><time dateTime={appointment.scheduled_at}>{appointmentDisplay(appointment.scheduled_at)}</time></p>
                        {appointment.location && <p className="care-muted">{appointment.location}</p>}
                        {appointment.notes && <p className="care-muted">{appointment.notes}</p>}
                        {canManage && (
                          <div className="schedule-actions">
                            <AppointmentForm key={appointment.scheduled_at} appointment={appointment} dateTime={appointmentInput(appointment.scheduled_at)} />
                            <AppointmentForm appointment={appointment} remove />
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </section>
          <section className="care-section" id="dose-history" aria-labelledby="dose-history-title">
            <h2 id="dose-history-title">Dose history</h2>
            <p className="care-muted">The last seven days, newest first.</p>
            {recentDoses.length === 0 ? <p className="care-empty">There are no past doses to review yet.</p> : (
              <details className="entry-details">
                <summary>View {recentDoses.length} {recentDoses.length === 1 ? "entry" : "entries"}</summary>
                <ol className="care-list">
                  {recentDoses.map((dose) => (
                    <li className="dose-row" key={dose.medication_id + dose.scheduled_for}>
                      <div className="dose-heading">
                        <time dateTime={dose.scheduled_for}>{historyDate.format(new Date(dose.scheduled_for))} · {doseTime(dose.scheduled_for)}</time>
                        <span className={"dose-status dose-" + dose.status}>{statusLabel(dose.status)}</span>
                      </div>
                      <strong>{dose.name}</strong> <span>{dose.dosage}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </section>
        </div>
        <div className="care-column">
          <section className="care-section adherence-panel" aria-labelledby="adherence-title">
            <h2 id="adherence-title">Last 7 days</h2>
            {week.percentage === null ? <p>No doses have been due in this period.</p> : (
              <>
                <p><strong className="adherence-score">{week.percentage}%</strong> recorded as taken</p>
                <progress value={week.taken} max={week.due} aria-label="Doses recorded as taken" />
                <p>{week.taken} of {week.due} scheduled doses so far.</p>
              </>
            )}
          </section>
          {overview.requests.length > 0 && (
            <section className="care-section" aria-labelledby="requests-title">
              <h2 id="requests-title">Pending changes</h2>
              <ul className="care-list">
                {overview.requests.map((change) => (
                  <li className="dose-row" key={change.id}>
                    <strong>{change.operation === "add" ? "Add" : change.operation === "edit" ? "Edit" : "Remove"} {change.payload.name}</strong>
                    {change.payload.previous && (
                      <p className="care-muted">
                        Current schedule · {change.payload.previous.name} · {change.payload.previous.dosage} · {change.payload.previous.times.map((time) => time.slice(0, 5)).join(", ")} IST
                      </p>
                    )}
                    {change.operation !== "remove" && <p>Proposed schedule · {change.payload.dosage} · {change.payload.times?.join(", ")} IST</p>}
                    {change.operation !== "remove" && (
                      <p className="care-muted">
                        {change.payload.days?.map((day) => weekdays[day]).join(", ")} · {change.payload.start_date}
                        {change.payload.end_date && ` to ${change.payload.end_date}`}
                      </p>
                    )}
                    {change.payload.instructions && <p className="care-muted">{change.payload.instructions}</p>}
                    {session.role === "elder" ? <ReviewButtons id={change.id} /> : <p className="care-muted">Waiting for the older adult to review.</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {hasChat && <CareChat />}
        </div>
      </div>
    </AccessLayout>
  );
}
