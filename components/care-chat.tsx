"use client";

import { useState, type FormEvent } from "react";

const suggestions = ["What’s scheduled today?", "Which doses are unconfirmed?", "Show the weekly dose log"];
type Message = { role: "user" | "assistant"; text: string; engine?: string };

export function CareChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || pending) return;

    setPending(true);
    setDraft("");
    setMessages((history) => [...history.slice(-18), { role: "user", text: question }]);
    try {
      const response = await fetch("/api/care-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const result = await response.json();
      setMessages((history) => [...history, {
        role: "assistant",
        text: response.ok ? result.answer : result.error ?? "CareCircle couldn’t answer that. Try again.",
        engine: result.engine,
      }]);
    } catch {
      setMessages((history) => [...history, { role: "assistant", text: "CareCircle couldn’t connect. Try again." }]);
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <section className="care-section care-chat" id="assistant" aria-labelledby="care-chat-title">
      <h2 id="care-chat-title">Care assistant</h2>
      <p className="care-muted">Ask about this profile’s schedule, recorded doses, or access. For medical questions, ask your care team.</p>
      <div className="chat-suggestions">
        {suggestions.map((text) => <button type="button" className="button button-secondary" key={text} disabled={pending} onClick={() => void ask(text)}>{text}</button>)}
      </div>
      <ol className="chat-history" role="log" aria-label="Care assistant conversation">
        {messages.map((message, index) => (
          <li key={index} data-role={message.role}>
            <strong>{message.role === "user" ? "You" : message.engine === "adaption" ? "Care assistant · Adaption" : "Care assistant"}</strong>
            {message.text}
          </li>
        ))}
      </ol>
      <p role="status">{pending && "Checking the care log…"}</p>
      <form className="access-form chat-form" onSubmit={submit}>
        <label>Your question
          <textarea placeholder="Ask about the care log" value={draft} maxLength={360} onChange={(event) => setDraft(event.target.value)} required />
        </label>
        <button type="submit" className="button" disabled={pending || !draft.trim()}>Send</button>
      </form>
    </section>
  );
}
