import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { createApp } from '../app.js';
import { createTokenVerifier } from '../auth.js';

const ISSUER = 'https://auth.example.test';
const RESOURCE = 'http://localhost:9999/'; // trailing slash on purpose: xaa.dev appends one

let privateKey, server, base;

const mint = ({ sub = 'customer1:alice@example.com', scope = 'tube.read oyster.use', aud = RESOURCE, iss = ISSUER, exp = '2h' } = {}) =>
  new SignJWT({ scope, client_id: 'client-at-tube' })
    .setProtectedHeader({ alg: 'RS256', typ: 'at+jwt', kid: 'k1' })
    .setIssuer(iss).setAudience(aud).setSubject(sub).setIssuedAt().setExpirationTime(exp)
    .sign(privateKey);

const rpc = async (token, method, params = {}) => {
  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await res.text();
  const data = text.split('\n').find((l) => l.startsWith('data:'));
  return { status: res.status, headers: res.headers, body: data ? JSON.parse(data.slice(5)) : text ? JSON.parse(text) : null };
};
const call = (token, name, args = {}) => rpc(token, 'tools/call', { name, arguments: args });
const textOf = (r) => r.body.result.content[0].text;

describe('XAA-ready Tube server', () => {
  before(async () => {
    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;
    const app = createApp({
      resourceUrl: RESOURCE,
      authServerMetadata: { issuer: ISSUER, authorization_endpoint: `${ISSUER}/auth`, token_endpoint: `${ISSUER}/token`, response_types_supported: ['code'] },
      verifier: createTokenVerifier({ issuer: ISSUER, jwks: keys.publicKey }),
    });
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://localhost:${server.address().port}`;
  });
  after(() => server.close());

  test('health and protected-resource metadata are public', async () => {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    const meta = await (await fetch(`${base}/.well-known/oauth-protected-resource`)).json();
    assert.equal(meta.resource, RESOURCE);
    assert.deepEqual(meta.authorization_servers, [ISSUER]);
    assert.deepEqual(meta.scopes_supported, ['tube.read', 'oyster.use']);
  });

  test('CORS: xaa.dev can call the server from the browser', async () => {
    const pre = await fetch(`${base}/mcp`, {
      method: 'OPTIONS',
      headers: { origin: 'https://app.xaa.dev', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization' },
    });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), 'https://app.xaa.dev');
    assert.match(pre.headers.get('access-control-allow-headers'), /authorization/);
    const health = await fetch(`${base}/health`, { headers: { origin: 'https://xaa.dev' } });
    assert.equal(health.headers.get('access-control-allow-origin'), 'https://xaa.dev');
    assert.equal((await fetch(`${base}/health`, { headers: { origin: 'https://evil.example' } })).headers.get('access-control-allow-origin'), null);
  });

  test('no token: 401 with a resource_metadata hint', async () => {
    const r = await rpc(null, 'tools/list');
    assert.equal(r.status, 401);
    assert.match(r.headers.get('www-authenticate'), /resource_metadata="[^"]*oauth-protected-resource/);
  });

  test('rejects wrong audience, wrong issuer, expired and forged tokens', async () => {
    assert.equal((await rpc(await mint({ aud: 'http://localhost:9999' }), 'tools/list')).status, 200, 'one trailing slash is tolerated by the SDK');
    assert.equal((await rpc(await mint({ aud: 'https://evil.example/' }), 'tools/list')).status, 401);
    assert.equal((await rpc(await mint({ iss: 'https://evil.example' }), 'tools/list')).status, 401);
    assert.equal((await rpc(await mint({ exp: '-1m' }), 'tools/list')).status, 401);
    const other = (await generateKeyPair('RS256')).privateKey;
    const forged = await new SignJWT({ scope: 'tube.read' }).setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER).setAudience(RESOURCE).setSubject('x').setExpirationTime('1h').sign(other);
    assert.equal((await rpc(forged, 'tools/list')).status, 401);
  });

  test('token without tube.read is refused with 403', async () => {
    const r = await rpc(await mint({ scope: 'oyster.use' }), 'tools/list');
    assert.equal(r.status, 403);
  });

  test('public tools work with tube.read alone', async () => {
    const token = await mint({ scope: 'tube.read' });
    const r = await call(token, 'plan_journey', { from: 'Brixton', to: 'Canary Wharf' });
    assert.equal(r.status, 200);
    assert.match(textOf(r), /Victoria/);
  });

  test('oyster tools need oyster.use', async () => {
    const token = await mint({ scope: 'tube.read' });
    const r = await call(token, 'oyster_balance');
    assert.notEqual(r.status, 200, `expected a scope challenge, got ${JSON.stringify(r.body)}`);
    assert.equal(r.status, 403);
    assert.match(r.headers.get('www-authenticate'), /insufficient_scope/);
  });

  test('each traveller gets their own Oyster card', async () => {
    const alice = await mint({ sub: 'customer1:alice@example.com' });
    const bob = await mint({ sub: 'customer1:bob@example.com' });
    await call(alice, 'book_journey', { from: 'Brixton', to: 'Canary Wharf' });
    assert.match(textOf(await call(alice, 'oyster_balance')), /£9\.20/);
    assert.match(textOf(await call(bob, 'oyster_balance')), /£15\.00/);
    assert.match(textOf(await call(bob, 'travel_history')), /No journeys yet/);
    assert.match(textOf(await call(alice, 'travel_history')), /Canary Wharf/);
  });
});
