import { redirect } from "next/navigation";
import { CircleAlert, LogOut } from "lucide-react";
import { isAuthEnabled, safeReturnPath } from "@/lib/auth/config";
import GoogleIcon from "../components/GoogleIcon";
import Logo from "../components/Logo";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  unauthorized:
    "Accesso non autorizzato: il tuo account non è abilitato a usare YarnColor Studio. Se pensi sia un errore, contatta l'amministratore.",
  login: "Accesso non riuscito. Riprova.",
  expired: "La richiesta di accesso è scaduta. Riprova.",
  config: "Accesso non disponibile: la configurazione dell'autenticazione è incompleta.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  // Anteprime: nessuna autenticazione dell'app.
  if (!isAuthEnabled()) redirect("/");

  const { next, error } = await searchParams;
  const message = error ? (ERRORS[error] ?? ERRORS.login) : null;
  const loginHref = `/api/auth/login?next=${encodeURIComponent(safeReturnPath(next))}`;

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <Logo size={64} />
          <h1>YarnColor Studio</h1>
          <p>Accedi con il tuo account Google.</p>
        </div>
        <div className="card" style={{ display: "grid", gap: 12 }}>
          {message && (
            <div className="callout callout-error" role="alert">
              <CircleAlert size={20} aria-hidden="true" />
              <div>{message}</div>
            </div>
          )}
          {error === "unauthorized" ? (
            // Chiude anche la sessione Cognito, così si può scegliere un altro account.
            <form action="/api/logout" method="post">
              <button type="submit" className="btn btn-outline btn-block">
                <LogOut size={18} aria-hidden="true" /> Esci e accedi con un altro account
              </button>
            </form>
          ) : (
            <a href={loginHref} className="btn btn-outline btn-block btn-google">
              <GoogleIcon /> Accedi con Google
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
