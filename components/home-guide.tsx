"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "../app/home.module.css";

const topics = {
  create: {
    text: "Create a care profile to get separate passcodes for the older adult, caretaker, and family member. Save them before leaving the page.",
    href: "/create",
    label: "Create a care profile",
  },
  join: {
    text: "Enter the passcode shared with you to open the care dashboard in your role.",
    href: "/join",
    label: "Join with a passcode",
  },
  schedule: {
    text: "The care dashboard shows scheduled doses and their recorded status. Caretakers can suggest changes for the older adult to review.",
    href: "/join",
    label: "Open your care dashboard",
  },
  assistant: {
    text: "The care assistant is available to caretakers and family members inside the shared dashboard. It can show the schedule, unconfirmed doses, and recorded progress.",
    href: "/join",
    label: "Join with a passcode",
  },
  overview: {
    text: "CareCircle helps households share medication schedules and dose records. Create a profile to set one up, or join with a passcode you’ve received.",
    href: "#how-it-works",
    label: "See how it works",
  },
};

function answerFor(question: string) {
  const text = question.toLowerCase();
  if (/\b(create|start|set ?up|new profile)\b/.test(text)) return topics.create;
  if (/\b(chat|bot|assistant)\b/.test(text)) return topics.assistant;
  if (/\b(passcode|join|sign in|log in|family|caretaker)\b/.test(text)) return topics.join;
  if (/\b(schedule|track|log|medication|medicine|dose)\b/.test(text)) return topics.schedule;
  return topics.overview;
}

export function HomeGuide() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<(typeof topics)[keyof typeof topics] | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (question.trim()) setAnswer(answerFor(question));
  }

  return (
    <div className={styles.prompt}>
      <form className={styles.promptBox} onSubmit={submit}>
        <label htmlFor="home-question" className={styles.visuallyHidden}>Ask how to use CareCircle</label>
        <textarea
          id="home-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask how to get started with CareCircle…"
          maxLength={240}
          rows={2}
          required
        />
        <button type="submit" disabled={!question.trim()} aria-label="Get an answer">
          <span className={styles.arrow} aria-hidden="true" />
        </button>
      </form>
      <div aria-live="polite">
        {answer && (
          <div className={styles.answer}>
            <p>{answer.text}</p>
            <Link href={answer.href}>{answer.label}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
