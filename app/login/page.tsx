import { Suspense } from "react";
import Logo from "../components/Logo";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <Logo size={64} />
          <h1>YarnColor Studio</h1>
          <p>Inserisci la password per accedere.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
