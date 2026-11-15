"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createProfile, inviteMember, joinProfile, passwordSignIn, verifyAccount } from "../app/access-actions";

function Feedback({ error, success }: { error?: string; success?: string }) {
  return error ? <p className="form-error" role="alert">{error}</p> :
    success ? <p className="form-success" role="status">{success}</p> : null;
}

export function CreateProfileForm({ emailAvailable }: { emailAvailable: boolean }) {
  const [state, action, pending] = useActionState(createProfile, {});
  const [owner, setOwner] = useState<"caretaker" | "family">("caretaker");

  if (state.success) return (
    <>
      <h1>Check your email</h1>
      <p role="status">{state.success}</p>
      <p>The link is valid for one hour.</p>
      <p className="alternate-link"><Link href="/join">Go to sign-in</Link></p>
    </>
  );

  return (
    <>
      <h1>Create a care profile</h1>
      <p>Start with the older adult’s details. A caretaker or family member verifies their email and sets up the first password.</p>
      {!emailAvailable && <p className="access-note" role="status">Email verification is temporarily unavailable. Existing members can still <Link href="/join">sign in</Link>.</p>}
      <form action={action} className="access-form">
        <fieldset className="access-fieldset">
          <legend>Older adult’s details</legend>
          <label>Full name<input name="elderName" required maxLength={80} autoComplete="name" /></label>
          <div className="access-fields">
            <label>Age<input name="age" type="number" min={1} max={120} required inputMode="numeric" /></label>
            <label>Gender<select name="gender" required defaultValue="" className="access-select">
              <option value="" disabled>Select an option</option>
              <option value="woman">Woman</option>
              <option value="man">Man</option>
              <option value="non-binary">Non-binary</option>
              <option value="self-described">Another gender</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select></label>
          </div>
          <label>Older adult’s email (optional)<input name="elderEmail" type="email" maxLength={254} /></label>
        </fieldset>
        <fieldset className="access-fieldset">
          <legend>Who will set the first password?</legend>
          <div className="access-radio">
            <label><input type="radio" name="ownerRole" value="caretaker" checked={owner === "caretaker"} onChange={() => setOwner("caretaker")} />Caretaker</label>
            <label><input type="radio" name="ownerRole" value="family" checked={owner === "family"} onChange={() => setOwner("family")} />Family member</label>
          </div>
          <label>{owner === "caretaker" ? "Caretaker’s email" : "Caretaker’s email (optional)"}<input name="caretakerEmail" type="email" required={owner === "caretaker"} maxLength={254} /></label>
          <label>{owner === "family" ? "Family member’s email" : "Family member’s email (optional)"}<input name="familyEmail" type="email" required={owner === "family"} maxLength={254} /></label>
          <p className="care-muted">Use a different email for each member. The first verified member can invite the others.</p>
        </fieldset>
        <Feedback {...state} />
        <button className="button" type="submit" disabled={pending || !emailAvailable}>{pending ? "Sending…" : "Send verification email"}</button>
      </form>
    </>
  );
}

export function PasswordSignInForm() {
  const [state, action, pending] = useActionState(passwordSignIn, {});
  return (
    <form action={action} className="access-form">
      <label>Email<input name="email" type="email" autoComplete="username" maxLength={254} required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={128} required /></label>
      <Feedback {...state} />
      <button className="button" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function VerifyAccountForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyAccount, {});
  return (
    <form action={action} className="access-form">
      <input type="hidden" name="token" value={token} />
      <label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      <Feedback {...state} />
      <button className="button" type="submit" disabled={pending}>{pending ? "Setting password…" : "Verify and open dashboard"}</button>
    </form>
  );
}

export function InviteMemberForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(inviteMember, {});
  return (
    <form action={action} className="dose-actions">
      <input type="hidden" name="target" value={id} />
      <button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send verification email"}</button>
      <Feedback {...state} />
    </form>
  );
}

export function JoinProfileForm() {
  const [state, action, pending] = useActionState(joinProfile, {});
  return (
    <form action={action} className="access-form">
      <label>Passcode<input name="passcode" placeholder="XXXX-XXXX-XXXX-XXXX" required maxLength={64} autoComplete="off" autoCapitalize="characters" spellCheck={false} /></label>
      <Feedback {...state} />
      <button className="button" type="submit" disabled={pending}>{pending ? "Checking passcode…" : "Open care dashboard"}</button>
    </form>
  );
}
