import { appConfig } from "@/config/app.config";

/**
 * L'autenticazione è attiva ovunque tranne nei deploy di anteprima Vercel, protetti da Vercel Deployment
 * Protection. In caso di dubbio (variabile assente, sviluppo locale) resta attiva.
 */
export function isAuthEnabled(): boolean {
  return process.env.VERCEL_ENV !== "preview";
}

export const CALLBACK_PATH = "/api/auth/callback";
export const SIGN_OUT_PATH = "/login";

export const callbackUrl = () => `${appConfig.auth.productionUrl}${CALLBACK_PATH}`;
export const signOutUrl = () => `${appConfig.auth.productionUrl}${SIGN_OUT_PATH}`;

export type CognitoSettings = {
  region: string;
  userPoolId: string;
  clientId: string;
  /** Origine della Hosted UI, es. https://example.auth.eu-west-1.amazoncognito.com */
  loginOrigin: string;
  allowedGroup: string;
};

/** Legge le variabili COGNITO_*. Restituisce null se ne manca qualcuna. */
export function cognitoSettings(): CognitoSettings | null {
  const region = process.env.COGNITO_REGION?.trim();
  const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
  const clientId = process.env.COGNITO_CLIENT_ID?.trim();
  const domain = process.env.COGNITO_LOGIN_DOMAIN?.trim();
  const allowedGroup = process.env.COGNITO_ALLOWED_GROUP?.trim();
  if (!region || !userPoolId || !clientId || !domain || !allowedGroup) return null;
  const loginOrigin = (/^https?:\/\//.test(domain) ? domain : `https://${domain}`).replace(/\/+$/, "");
  return { region, userPoolId, clientId, loginOrigin, allowedGroup };
}

/** URL del logout di Cognito: chiude la sessione Cognito e torna alla pagina di login. */
export function cognitoLogoutUrl(settings: CognitoSettings): string {
  const url = new URL("/logout", settings.loginOrigin);
  url.searchParams.set("client_id", settings.clientId);
  url.searchParams.set("logout_uri", signOutUrl());
  return url.toString();
}

/** Percorso interno sicuro a cui tornare dopo il login (mai un altro sito). */
export function safeReturnPath(value: string | null | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
