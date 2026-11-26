import { createApp } from './app.js';
import { createTokenVerifier, fetchAuthServerMetadata, remoteJwks } from './auth.js';

const PORT = process.env.PORT ?? 8080;
// Authorization Server that issues the access tokens (xaa.dev's playground AS by default).
const AUTH_URL = process.env.AUTH_URL ?? 'https://auth.resource.xaa.dev';
// Public URL of this server. It must match what you register in xaa.dev, because it becomes the token's `aud`.
const RESOURCE_URL = process.env.RESOURCE_URL ?? `http://localhost:${PORT}`;

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
