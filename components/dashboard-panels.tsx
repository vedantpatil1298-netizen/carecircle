import { AppointmentForm } from "./appointment-form";
import { DoseButtons, MedicationForm, RemoveMedication, ReviewButtons } from "./medication-forms";
import { appointmentDisplay, appointmentInput, type Appointment } from "../lib/appointments";
import { adherence, careTimeZone, dateInCareZone, doseTime, statusLabel, weekdays, type MedicationOverview } from "../lib/medications";
import type { CareRole } from "../lib/care-access";

export function TodayPanel({ overview, role }: { overview: MedicationOverview; role: CareRole }) {
  const today = overview.doses.filter((dose) => dose.is_today);
  const canManage = role !== "family";
  return (
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
  );
}

export function MedicationPanel({ overview, role }: { overview: MedicationOverview; role: CareRole }) {
  const canManage = role !== "family";
  const caretaker = role === "caretaker";
  const today = dateInCareZone();
  return (
    <section className="care-section" id="schedule" aria-labelledby="schedule-title">
      <h2 id="schedule-title">Medication schedules</h2>
      {canManage && <MedicationForm today={today} request={caretaker} />}
      {overview.medications.length === 0 ? <p className="care-empty">There are no active schedules yet.</p> : (
        <ul className="care-list">
          {overview.medications.map((medication) => (
            <li key={medication.id} className="dose-row">
              <strong>{medication.name}</strong> <span>{medication.dosage}</span>
              <p className="care-muted">{medication.times.map((time) => time.slice(0, 5)).join(", ")} IST · {medication.days.length === 7 ? "Every day" : medication.days.map((day) => weekdays[day]).join(", ")}</p>
              {canManage && (
                <div className="schedule-actions">
                  <MedicationForm medication={medication} today={today} request={caretaker} />
                  <RemoveMedication medication={medication} request={caretaker} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AppointmentsPanel({ appointments, role }: { appointments: Appointment[] | null; role: CareRole }) {
  const canManage = role !== "family";
  return (
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
  );
}

export function HistoryPanel({ overview }: { overview: MedicationOverview }) {
  const recentDoses = overview.doses.filter((dose) => dose.status !== "upcoming").reverse();
  const historyDate = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: careTimeZone });
  return (
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
  );
}

export function AdherencePanel({ overview }: { overview: MedicationOverview }) {
  const week = adherence(overview.doses);
  return (
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
  );
}

export function RequestsPanel({ overview, role }: { overview: MedicationOverview; role: CareRole }) {
  if (overview.requests.length === 0) return null;
  return (
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
            {role === "elder" ? <ReviewButtons id={change.id} /> : <p className="care-muted">Waiting for the older adult to review.</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
