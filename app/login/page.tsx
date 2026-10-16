import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 380, paddingTop: 80 }}>
      <h1>YarnColor Studio</h1>
      <p className="muted">Inserisci la password per accedere.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
