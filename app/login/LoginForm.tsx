"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, LoaderCircle } from "lucide-react";

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
      <label htmlFor="password" className="field-label" style={{ marginBottom: 0 }}>
        <Lock size={16} aria-hidden="true" /> Password
      </label>
      <input
        id="password"
        className="input"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={pending || !password}>
        {pending ? (
          <>
            <LoaderCircle size={18} className="spin" aria-hidden="true" /> Verifica…
          </>
        ) : (
          "Accedi"
        )}
      </button>
    </form>
  );
}
