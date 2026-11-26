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

### 5b. For AI assistants: prepare the xaa.dev values

> If you are an AI assistant (Claude Code or similar) working through this file, do this **after Step 5 and before the human starts Step 6**. You cannot use the xaa.dev wizard yourself, so produce a ready-to-paste sheet of values for the human.

1. **Verify first.** Run `npm test` and expect 8 of 8. Start the server (`npm run server`), then confirm `curl -s localhost:8080/health` returns `{"status":"ok"}`, `curl -s localhost:8080/.well-known/oauth-protected-resource` names `https://auth.resource.xaa.dev`, and an unauthenticated `POST /mcp` returns `401` with a `WWW-Authenticate` header. If any check fails, fix it before continuing. Stop the server afterwards.
2. **Read the values from the code, do not guess:**
   - Port and URL: `PORT` and `RESOURCE_URL` in `server/server.js` (default `http://localhost:8080`). If the human uses a tunnel, use the public URL instead.
   - Scopes: `SCOPES` in `server/auth.js`.
   - Which tools need which scope: the `registerTool` calls in `server/app.js` (the `scopeChallenge` option marks `oyster.use`).
   - Health path: the `app.get('/health', ...)` route.
3. **Print the table below, filled in, as one copy-paste block.** Use the exact field labels from the xaa.dev wizard. Then tell the human to open <https://xaa.dev/developer/test-resource>, click **Register custom resource**, and paste the values in order.

Fill in this template (values shown are the defaults for this repo):

| Wizard step | Field | Value |
|---|---|---|
| 1. Basic Info | Resource name | `Tube Companion` |
| 1. Basic Info | Description | `London Tube MCP server: line status, journey planning, Cockney slang, and a personal Oyster card per traveller.` |
| 1. Basic Info | Server URL | `http://localhost:8080` (must equal `RESOURCE_URL`; it becomes the token's `aud`) |
| 1. Basic Info | Health endpoint | `/health` |
| 2. Auth Server | Choice | `Playground` |
| 3. Scopes | Scope 1 | `tube.read` |
| 3. Scopes | Scope 2 | `oyster.use` |
| 3. Endpoints (optional) | Endpoint | `POST /mcp` |
| 4. MCP | This resource also has an MCP server | tick |
| 4. MCP | MCP Server URL | `http://localhost:8080/mcp` |
| 4. MCP | MCP Resource URIs | leave blank (or `tube://oyster` if required) |
| 5. Test Client | | Nothing to enter. Save the credentials. |

If the code you read differs from the defaults above (another port, extra scopes, renamed tools), print the values from the code instead. If a tunnel is in use, replace both URLs with the public one and remind the human to start the server with `RESOURCE_URL=<public url> npm run server`.

### 6. Register your server in the xaa.dev tester

Use the sheet from Step 5b. Start your server first: `npm run server` (port 8080). Then open [xaa.dev/developer/test-resource](https://xaa.dev/developer/test-resource), enter any email to unlock it, click **Register custom resource** and walk through the wizard:

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

Use these tool calls in **Send MCP Request** (the tool name, then the JSON arguments). They are in the order that proves everything works:

| # | Tool | Arguments (JSON) | Scope needed | Expect |
|---|---|---|---|---|
| 1 | `line_status` | `{ "line": "Jubilee" }` | `tube.read` | Jubilee status. Use `{}` for every line |
| 2 | `plan_journey` | `{ "from": "Brixton", "to": "Canary Wharf" }` | `tube.read` | 2 legs (Victoria, then Jubilee), 12 stops, fare £5.80 |
| 3 | `cockney_translator` | `{ "phrase": "apples and pears" }` | `tube.read` | "stairs" |
| 4 | `oyster_balance` | `{}` | `oyster.use` | `£15.00` |
| 5 | `top_up_oyster` | `{ "amount": 10 }` | `oyster.use` | `£25.00` (amount is £1 to £50) |
| 6 | `book_journey` | `{ "from": "Brixton", "to": "Canary Wharf" }` | `oyster.use` | charged `£5.80` |
| 7 | `oyster_balance` | `{}` | `oyster.use` | lower than before booking |
| 8 | `travel_history` | `{}` | `oyster.use` | one Brixton to Canary Wharf journey |

If you skip call 5, call 4 shows £15.00, call 6 charges £5.80, and call 7 shows `£9.20`.

The same call as raw JSON-RPC, if the tester asks for a request body:

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": { "name": "book_journey", "arguments": { "from": "Brixton", "to": "Canary Wharf" } } }
```

Other station names that work: `Heathrow Terminals 2 & 3`, `Stratford`, `Victoria`, `Waterloo`, `King's Cross St Pancras`. Other slang: `dog and bone`, `trouble and strife`, `porky pies`, `rosie lee`.

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
