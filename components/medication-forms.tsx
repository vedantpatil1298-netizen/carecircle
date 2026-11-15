"use client";

import { useActionState, useState } from "react";
import { recordDose, reviewChange, saveMedication } from "../app/medication-actions";
import type { Dose, Medication } from "../lib/medications";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function FormFeedback({ error, success }: { error?: string; success?: string }) {
  return error ? <p className="form-error" role="alert">{error}</p> :
    success ? <p className="form-success" role="status">{success}</p> : null;
}

export function MedicationForm({ medication, today, request }: { medication?: Medication; today: string; request: boolean }) {
  const [state, action, pending] = useActionState(saveMedication, {});
  const [timeCount, setTimeCount] = useState(medication?.times.length ?? 1);
  const saved = !!state.success;
  const actionLabel = medication ? "Edit schedule" : "Add medication";

  return (
    <details className="entry-details">
      <summary>{request ? (medication ? "Suggest an edit" : "Suggest a medication") : actionLabel}</summary>
      <form action={action} className="access-form schedule-form">
        <input type="hidden" name="operation" value={medication ? "edit" : "add"} />
        {medication && <input type="hidden" name="id" value={medication.id} />}
        <label>Medication name<input name="name" defaultValue={medication?.name} required maxLength={100} /></label>
        <label>Dose as prescribed<input name="dosage" defaultValue={medication?.dosage} required maxLength={80} /></label>
        <label>Existing instructions (optional)<input name="instructions" defaultValue={medication?.instructions ?? ""} maxLength={240} /></label>
        <fieldset className="time-choices">
          <legend>Scheduled times (IST)</legend>
          <div>
            {Array.from({ length: timeCount }, (_, index) => (
              <input key={index} type="time" name="times" aria-label={`Dose time ${index + 1}`} defaultValue={medication?.times[index]?.slice(0, 5)} required={index === 0} />
            ))}
          </div>
          {timeCount < 6 && <button type="button" className="button button-secondary" onClick={() => setTimeCount(timeCount + 1)}>Add another time</button>}
        </fieldset>
        <fieldset>
          <legend>Days of the week</legend>
          <div className="weekday-choices">
            {dayLabels.map((day, index) => (
              <label key={day}><input type="checkbox" name="days" value={index} defaultChecked={medication?.days.includes(index) ?? true} />{day}</label>
            ))}
          </div>
        </fieldset>
        <div className="form-dates">
          <label>Start date<input type="date" name="start" defaultValue={medication?.start_date ?? today} required /></label>
          <label>End date (optional)<input type="date" name="end" defaultValue={medication?.end_date ?? ""} /></label>
        </div>
        <FormFeedback {...state} />
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving…" : request ? "Send for approval" : saved && !medication ? "Save another schedule" : "Save schedule"}
        </button>
      </form>
    </details>
  );
}

export function RemoveMedication({ medication, request }: { medication: Medication; request: boolean }) {
  const [state, action, pending] = useActionState(saveMedication, {});
  return (
    <details className="entry-details">
      <summary>{request ? "Suggest removing" : "Remove schedule"}</summary>
      <form action={action} className="access-form schedule-form">
        <input type="hidden" name="id" value={medication.id} />
        <input type="hidden" name="operation" value="remove" />
        <input type="hidden" name="name" value={medication.name} />
        <p>Past dose records will stay in the log.</p>
        <FormFeedback {...state} />
        <button className="button button-secondary" type="submit" disabled={pending || !!state.success}>
          {request ? "Send removal request" : "Confirm removal"}
        </button>
      </form>
    </details>
  );
}

export function DoseButtons({ dose }: { dose: Dose }) {
  const [state, action, pending] = useActionState(recordDose, {});
  return (
    <form action={action} className="dose-actions">
      <input type="hidden" name="id" value={dose.medication_id} />
      <input type="hidden" name="scheduled" value={dose.scheduled_for} />
      <button className="button" type="submit" name="status" value="taken" disabled={pending}>Mark taken</button>
      <button className="button button-secondary" type="submit" name="status" value="skipped" disabled={pending}>Skip</button>
      <FormFeedback {...state} />
    </form>
  );
}

export function ReviewButtons({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reviewChange, {});
  return (
    <form action={action} className="dose-actions">
      <input type="hidden" name="id" value={id} />
      <button className="button" type="submit" name="choice" value="approve" disabled={pending}>Approve</button>
      <button className="button button-secondary" type="submit" name="choice" value="reject" disabled={pending}>Reject</button>
      <FormFeedback {...state} />
    </form>
  );
}
