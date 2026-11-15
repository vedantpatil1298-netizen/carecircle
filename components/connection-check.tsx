"use client";

import { useState } from "react";

type CheckStatus = "idle" | "checking" | "connected" | "unavailable";

const messages: Record<CheckStatus, string> = {
  idle: "",
  checking: "Checking the connection…",
  connected: "CareCircle can reach Supabase.",
  unavailable: "CareCircle couldn’t reach Supabase. Try again in a moment.",
};

export function ConnectionCheck() {
  const [status, setStatus] = useState<CheckStatus>("idle");

  async function check() {
    setStatus("checking");

    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const result = await response.json();
      setStatus(response.ok && result.connected === true ? "connected" : "unavailable");
    } catch {
      setStatus("unavailable");
    }
  }

  return (
    <div className="connection-check">
      <button type="button" onClick={check} disabled={status === "checking"}>
        Check connection
      </button>
      <p role="status">{messages[status]}</p>
    </div>
  );
}
