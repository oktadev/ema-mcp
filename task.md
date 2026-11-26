# Task: Make the Tube MCP server XAA-ready

## The problem

`server/` is a working Tube MCP server, but it trusts everyone:

- Anyone can call `/mcp`. There is no login.
- There is one Oyster card for the whole world, shared by every caller.

**Goal:** make it a **Resource App** that works with the [xaa.dev](https://xaa.dev) playground (Cross App Access). It must accept only XAA-issued access tokens and know *who* is calling, so each traveller gets their own card.

You do not build login. The Authorization Server issues tokens. Your server only **verifies** them.

## Already done for you

- Dependencies are installed (`jose` included). Run `npm install` once at the repo root.
- `server/auth.js` has the scopes (`tube.read`, `oyster.use`), the JWKS loader and the Auth Server metadata fetch.
- `server/server.js` and `server/app.js` are wired up: `createApp()` receives your verifier, the resource URL and the Auth Server metadata. The `/health` endpoint exists.
- Every place you need to edit is marked `TODO` or `STEP n`.
- `npm test` checks your work. No xaa.dev account or real token is needed for it.
- CORS for `xaa.dev` and `app.xaa.dev` is already set up, because the tester calls your server from the browser.
- The client sends a token when you set `MCP_TOKEN`.

Start with `npm test`. You should see **2 passing, 6 failing**. Your job is to get to 8 of 8.

## Steps

Each step links to the exact line to edit. Line numbers drift as you type, so each link also names a marker you can search for.

### 1. Verify tokens

**Edit:** [`server/auth.js` line 48](server/auth.js#L48), the body of `verifyAccessToken` (search for `STEP 1`). The comment right above it spells out the contract.

- `jwtVerify(token, jwks, { issuer, algorithms: ['RS256'] })` checks the signature, `iss` and `exp`.
- On failure, throw `OAuthError(OAuthErrorCode.InvalidToken, ...)`. Both names are already imported.
- On success, return the token's `scopes`, `resource` (from `aud`) and `extra: { sub }`.

### 2. Publish discovery metadata

**Edit:** [`server/app.js` line 149](server/app.js#L149) (search for `STEP 2`). The `app` and `authServerMetadata` values are already in scope, and the comment has the call to paste.

Add to the imports at the top of the file: `mcpAuthMetadataRouter` from `@modelcontextprotocol/express` ([line 3](server/app.js#L3)).

This serves `/.well-known/oauth-protected-resource`, which is how an agent learns which Authorization Server to use.

### 3. Require a token on `/mcp`

**Edit:** [`server/app.js` line 154](server/app.js#L154) (search for `STEP 3`) to create `authenticate`, then add it to the route at [line 161](server/app.js#L161): `app.post('/mcp', authenticate, ...)`.

Add to the imports: `requireBearerAuth` from `@modelcontextprotocol/express` ([line 3](server/app.js#L3)), and `getOAuthProtectedResourceMetadataUrl` from `@modelcontextprotocol/server` ([line 2](server/app.js#L2)).

The token's `aud` must match this server's URL, and the `tube.read` scope is required.

### 4. Protect the personal tools

**Edit:** the four tools from [`server/app.js` line 91](server/app.js#L91) to [line 128](server/app.js#L128): `oyster_balance`, `top_up_oyster`, `book_journey` and `travel_history` (search for `STEP 4`).

Add `scopeChallenge: requireScopes(SCOPES.OYSTER)` to each tool's options. Import `requireScopes` from `@modelcontextprotocol/server` ([line 2](server/app.js#L2)). Leave the three public tools alone.

### 5. One Oyster card per traveller

**Edit:** the global card at [`server/app.js` line 10](server/app.js#L10) (search for `STEP 5`), and the same four tools as Step 4.

Replace the global `oyster` with a `Map` of cards keyed by the token's `sub`, with a £15.00 balance created on first use. In each personal tool, read the `sub` from `ctx.http.authInfo.extra.sub`, where `ctx` is the tool handler's last argument.

### 6. Register your server in the xaa.dev tester

Start your server first: `npm run server` (port 8080). Then open [xaa.dev/developer/test-resource](https://xaa.dev/developer/test-resource), enter any email to unlock it, click **Register custom resource** and walk through the wizard:

| Wizard step | What to enter |
|---|---|
| 1. Basic Info | Name: `Tube Companion`. Server URL: `http://localhost:8080`. Health endpoint: `/health` |
| 2. Auth Server | **Playground** |
| 3. Scopes & Endpoints | Add the scopes `tube.read` and `oyster.use` |
| 4. MCP | Tick **This resource also has an MCP server**. MCP Server URL: `http://localhost:8080/mcp` |
| 5. Test Client | Save the credentials it shows |

Notes:
- The server URL you enter becomes the token's `aud`, so it must match `RESOURCE_URL`.
- xaa.dev adds a trailing slash to the audience (`http://localhost:8080/`). The SDK tolerates that.
- Scope names must match exactly: `oyster.use`, not `oyster:use`.
- The health check runs from your browser. CORS is already handled for you. If it still cannot reach `localhost`, click **Connect Anyway**, or expose the server with a tunnel and restart it as `RESOURCE_URL=<public url> npm run server`.

### 7. Run the flow against your server

In the tester, run the four steps:

1. **Login:** use any email and any 6-digit code.
2. **Token Exchange:** the ID token becomes an ID-JAG. Check the `scope` in the decoded panel.
3. **JWT Bearer Grant:** the ID-JAG becomes your access token. Check that `iss` is `https://auth.resource.xaa.dev` and `aud` is your server URL.
4. **Call the resource:** use **Send MCP Request**. A `200` means the whole chain works.

Then check the traveller isolation: log in again with a different email. It should show a fresh £15.00 Oyster card.

You can also copy the access token from Step 3 and use it from the terminal client:

```sh
MCP_TOKEN=<access token> npm run client
```

Without a token the client gets a 401. That is the point of the lab.

**If Step 4 fails:**
- `401` and `invalid_token`: check `iss`, `aud` (trailing slash) and the JWKS URL. The server log and `npm test` help here.
- `403`: the token lacks a scope. Re-register the scopes in the wizard, then run the flow again.
- Network error: the server must listen on `0.0.0.0` (it does).

## Done when

- `npm test` passes **8 of 8**.
- Step 4 of the xaa.dev tester returns `200` against your server.
- A second email gets its own Oyster card.

## Stuck?

Read the comment at the `TODO` you are on. It names the exact SDK function to use.
