import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';

// Scopes this resource understands. Register the same names in xaa.dev.
export const SCOPES = {
  READ: 'tube.read', // public information: line status, journey planning, slang
  OYSTER: 'oyster.use', // personal: balance, top-ups, bookings, history
};

// --- Already done for you ------------------------------------------------------

/** The Authorization Server's public keys, fetched and cached on demand. */
export const remoteJwks = (authUrl) => createRemoteJWKSet(new URL('/jwks', authUrl));

/** Fetches RFC 8414 metadata so the 401 challenge can point clients at the Auth Server. */
export async function fetchAuthServerMetadata(authUrl) {
  const url = new URL('/.well-known/oauth-authorization-server', authUrl);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}: HTTP ${res.status}`);
  return res.json();
}

// --- STEP 1: your turn ---------------------------------------------------------

/**
 * Builds the verifier that the MCP SDK's requireBearerAuth calls with every bearer token.
 *
 * TODO: implement verifyAccessToken(token). It must:
 *   1. Verify the token with jose's jwtVerify(token, jwks, { issuer, algorithms: ['RS256'] }).
 *      That checks the signature, `iss` and `exp`.
 *   2. If verification throws, throw
 *      new OAuthError(OAuthErrorCode.InvalidToken, `Token rejected: ${err.code ?? err.message}`).
 *      The SDK turns that into a 401 with a WWW-Authenticate challenge.
 *   3. Otherwise return AuthInfo:
 *      {
 *        token,
 *        clientId: payload.client_id ?? '',
 *        scopes: the space-separated `scope` claim, split into an array,
 *        expiresAt: payload.exp,
 *        resource: new URL(aud),   // `aud` may be a string or an array: use the first entry
 *        extra: { sub: payload.sub },  // identifies the traveller, e.g. "customer1:alice@example.com"
 *      }
 *
 * @param {{ issuer: string, jwks: Parameters<typeof jwtVerify>[1] }} options
 */
export function createTokenVerifier({ issuer, jwks }) {
  return {
    async verifyAccessToken(_token) {
      // Remove this line and write the real thing. OAuthError and OAuthErrorCode are imported for you.
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'TODO: implement verifyAccessToken in server/auth.js');
    },
  };
}
