"use client";

import { useActionState } from "react";
import { saveAppointment } from "../app/appointment-actions";
import type { Appointment } from "../lib/appointments";

export function AppointmentForm({ appointment, dateTime, remove = false }: {
  appointment?: Appointment; dateTime?: string; remove?: boolean;
}) {
  const [state, action, pending] = useActionState(saveAppointment, {});
  const label = remove ? "Remove appointment" : appointment ? "Edit appointment" : "Add appointment";

  return (
    <details className="entry-details">
      <summary>{label}</summary>
      <form action={action} className="access-form schedule-form">
        <input type="hidden" name="operation" value={remove ? "remove" : appointment ? "edit" : "add"} />
        {appointment && <input type="hidden" name="id" value={appointment.id} />}
        {remove ? <p>Remove this appointment from the shared calendar?</p> : (
          <>
            <label>Doctor or clinic<input name="doctor" defaultValue={appointment?.doctor_name} maxLength={100} required /></label>
            <label>Date and time (IST)<input name="dateTime" type="datetime-local" defaultValue={dateTime} required /></label>
            <label>Location (optional)<input name="location" defaultValue={appointment?.location ?? ""} maxLength={160} /></label>
            <label>Notes (optional)<input name="notes" defaultValue={appointment?.notes ?? ""} maxLength={400} /></label>
          </>
        )}
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {state.success && <p className="form-success" role="status">{state.success}</p>}
        <button type="submit" className="button" disabled={pending || (remove && !!state.success)}>
          {pending ? "Saving…" : remove ? "Confirm removal" : "Save appointment"}
        </button>
      </form>
    </details>
  );
}
