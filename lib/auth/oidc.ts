import "server-only";
import * as client from "openid-client";
import { callbackUrl, type CognitoSettings } from "./config";

/**
 * Client OpenID Connect per Cognito: App Client pubblico con PKCE, senza client secret.
 * Endpoint della Hosted UI dal dominio di login; issuer e chiavi dal pool.
 */
export function cognitoClient(settings: CognitoSettings): client.Configuration {
  const issuer = `https://cognito-idp.${settings.region}.amazonaws.com/${settings.userPoolId}`;
  const config = new client.Configuration(
    {
      issuer,
      authorization_endpoint: `${settings.loginOrigin}/oauth2/authorize`,
      token_endpoint: `${settings.loginOrigin}/oauth2/token`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
    },
    settings.clientId,
    { token_endpoint_auth_method: "none", redirect_uris: [callbackUrl()] },
    client.None(),
  );
  // Verifica anche la firma del token di identità con le chiavi pubbliche del pool.
  client.enableNonRepudiationChecks(config);
  return config;
}

export async function buildLoginUrl(
  settings: CognitoSettings,
): Promise<{ url: URL; verifier: string; state: string; nonce: string }> {
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const url = client.buildAuthorizationUrl(cognitoClient(settings), {
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state,
    nonce,
    // Va direttamente a Google, senza la pagina di scelta della Hosted UI.
    identity_provider: "Google",
  });
  return { url, verifier, state, nonce };
}

export type CognitoUser = { email: string; name?: string; groups: string[] };

/** Scambia il codice e restituisce l'utente dal token di identità verificato. */
export async function completeLogin(
  settings: CognitoSettings,
  requestUrl: URL,
  checks: { verifier: string; state: string; nonce: string },
): Promise<CognitoUser> {
  // La redirect_uri inviata nello scambio deve coincidere con quella registrata in Cognito.
  const currentUrl = new URL(callbackUrl());
  currentUrl.search = requestUrl.search;
  const tokens = await client.authorizationCodeGrant(cognitoClient(settings), currentUrl, {
    pkceCodeVerifier: checks.verifier,
    expectedState: checks.state,
    expectedNonce: checks.nonce,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims) throw new Error("Token di identità mancante.");
  const groups = Array.isArray(claims["cognito:groups"])
    ? (claims["cognito:groups"] as unknown[]).filter((g): g is string => typeof g === "string")
    : [];
  const email = typeof claims.email === "string" ? claims.email : String(claims.sub);
  const name = typeof claims.name === "string" ? claims.name : undefined;
  return { email, name, groups };
}
