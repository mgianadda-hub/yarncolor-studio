"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      const next = searchParams.get("next");
      // Solo percorsi interni, per evitare redirect verso altri siti.
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return;
    }
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(data?.error ?? "Accesso non riuscito.");
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12 }}>
      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button type="submit" disabled={pending || !password}>
        {pending ? "Verifica…" : "Accedi"}
      </button>
    </form>
  );
}
