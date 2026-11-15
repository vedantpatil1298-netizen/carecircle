"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createProfile, joinProfile } from "../app/access-actions";

function CopyCode({ label, code }: { label: string; code: string }) {
  const [feedback, setFeedback] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("Copied");
    } catch {
      setFeedback("Select and copy the code above.");
    }
  }

  return (
    <li className="passcode-row">
      <div>
        <strong>{label}</strong>
        <code>{code}</code>
        <span className="copy-feedback" role="status">{feedback}</span>
      </div>
      <button type="button" className="button button-secondary" onClick={copy} aria-label={`Copy ${label.toLowerCase()} passcode`}>
        Copy
      </button>
    </li>
  );
}

export function CreateProfileForm() {
  const [state, action, pending] = useActionState(createProfile, {});

  if (state.passcodes) {
    return (
      <>
        <h1>Your passcodes</h1>
        <p>Save these now. Share each passcode only with the person who should use that role.</p>
        <ul className="passcode-list">
          <CopyCode label="Older adult" code={state.passcodes.elder} />
          <CopyCode label="Caretaker" code={state.passcodes.caretaker} />
          <CopyCode label="Family member" code={state.passcodes.family} />
        </ul>
        <Link href="/dashboard" className="button">Open care dashboard</Link>
      </>
    );
  }

  return (
    <>
      <h1>Create a care profile</h1>
      <p>You’ll get separate passcodes for the older adult, caretaker, and family.</p>
      <form action={action} className="access-form">
        <label>
          Older adult’s name
          <input name="elderName" required maxLength={80} autoComplete="off" />
        </label>
        <label>
          Caretaker email <span>(optional)</span>
          <input name="caretakerEmail" type="email" maxLength={254} autoComplete="off" />
        </label>
        <label>
          Family email <span>(optional)</span>
          <input name="familyEmail" type="email" maxLength={254} autoComplete="off" />
        </label>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Creating profile…" : "Create profile"}
        </button>
      </form>
    </>
  );
}

export function JoinProfileForm() {
  const [state, action, pending] = useActionState(joinProfile, {});
  return (
    <form action={action} className="access-form">
      <label>
        Passcode
        <input name="passcode" placeholder="XXXX-XXXX-XXXX-XXXX" required maxLength={64} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      </label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Checking passcode…" : "Open care dashboard"}
      </button>
    </form>
  );
}
