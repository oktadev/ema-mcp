import { createApp } from './app.js';
import { createTokenVerifier, fetchAuthServerMetadata, remoteJwks } from './auth.js';

const PORT = process.env.PORT ?? 8080;
// Authorization Server that issues the access tokens (xaa.dev's playground AS by default).
const AUTH_URL = process.env.AUTH_URL ?? 'https://auth.resource.xaa.dev';
// Public URL of this server. It must match what you register in xaa.dev, because it becomes the token's `aud`.
// In a Codespace it defaults to the forwarded port URL plus /mcp, matching the demo's xaa.dev registration.
const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: FORWARDING_DOMAIN } = process.env;
const RESOURCE_URL =
  process.env.RESOURCE_URL ??
  (CODESPACE_NAME && FORWARDING_DOMAIN
    ? `https://${CODESPACE_NAME}-${PORT}.${FORWARDING_DOMAIN}/mcp`
    : `http://localhost:${PORT}`);

const authServerMetadata = await fetchAuthServerMetadata(AUTH_URL);

const app = createApp({
  resourceUrl: RESOURCE_URL,
  authServerMetadata,
  verifier: createTokenVerifier({ issuer: authServerMetadata.issuer, jwks: remoteJwks(AUTH_URL) }),
  allowedHosts: ['localhost', '127.0.0.1', new URL(RESOURCE_URL).hostname],
});

app.listen(PORT, () => {
  console.log(`tube-companion listening on port ${PORT}`);
  console.log(`  resource  ${RESOURCE_URL}`);
  console.log(`  issuer    ${authServerMetadata.issuer}`);
});
