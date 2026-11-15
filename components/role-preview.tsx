"use client";

import { useState } from "react";
import styles from "../app/home.module.css";

const roles = [
  {
    label: "Older adult",
    title: "Know what’s due today",
    description: "See your medication times at a glance and decide whether to approve changes to your schedule.",
    items: [["Morning medication", "Taken · 8:00 AM"], ["Proposed schedule change", "Waiting for your review"]],
  },
  {
    label: "Caretaker",
    title: "Keep the routine on track",
    description: "Record doses, propose schedule updates, and keep the next clinic visit on the shared calendar.",
    items: [["Evening medication", "Due · 7:00 PM"], ["Follow-up visit", "Tomorrow · 11:30 AM"]],
  },
  {
    label: "Family member",
    title: "Stay in the loop",
    description: "See which doses were recorded, add an appointment, and ask the care assistant about the shared log.",
    items: [["Today’s dose log", "One dose recorded as taken"], ["Clinic visit", "Added to the calendar"]],
  },
];

export function RolePreview() {
  const [selected, setSelected] = useState(0);
  const role = roles[selected];

  return (
    <div className={styles.rolePreview}>
      <div className={styles.roleOptions} role="group" aria-label="Choose a role to preview">
        {roles.map(({ label }, index) => (
          <button type="button" key={label} aria-pressed={selected === index} onClick={() => setSelected(index)}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.roleCard} aria-live="polite">
        <div key={role.label}>
          <h3>{role.title}</h3>
          <p>{role.description}</p>
          <figure className={styles.sampleSchedule}>
            <figcaption>Example care dashboard</figcaption>
            <ul>
              {role.items.map(([title, status]) => <li key={title}><strong>{title}</strong><span>{status}</span></li>)}
            </ul>
          </figure>
        </div>
      </div>
    </div>
  );
}
