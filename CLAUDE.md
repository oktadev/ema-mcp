# mcp-lab: Tube MCP server, made XAA-ready

Lab project. `server/` is a London Tube MCP server that must become an OAuth **Resource App** for the [xaa.dev](https://xaa.dev) playground (Cross App Access). It only **verifies** tokens; the Authorization Server (`https://auth.resource.xaa.dev`) issues them. Do not build login.

**The assignment is in `task.md`.** Read it before changing code: steps 1-5 are code, 5b-7 are xaa.dev registration and manual testing.

## Layout
- `server/auth.js`: scopes (`tube.read`, `oyster.use`), JWKS loader, `createTokenVerifier` (Step 1)
- `server/app.js`: Express app, MCP tools, `/health`, discovery metadata, auth middleware (Steps 2-5)
- `server/server.js`: entrypoint; reads `PORT` (8080), `AUTH_URL`, `RESOURCE_URL`
- `server/london.js`: Tube data and journey logic; `server/test/`: the `npm test` suite
- `client/`: terminal MCP client; sends a bearer token when `MCP_TOKEN` is set

## Commands
- `npm install` (once), `npm test` (target: 8 of 8), `npm run server`, `npm run client`

## Rules that matter
- Public tools (`line_status`, `plan_journey`, `cockney_translator`) need `tube.read`. The four Oyster tools (`oyster_balance`, `top_up_oyster`, `book_journey`, `travel_history`) also need `oyster.use` via `scopeChallenge: requireScopes(SCOPES.OYSTER)`.
- Oyster cards are per traveller: key a `Map` by `ctx.http.authInfo.extra.sub`, start at £15.00.
- The token's `aud` must equal `RESOURCE_URL` exactly. For xaa.dev registration that is the MCP URL: run `RESOURCE_URL=<public url>/mcp npm run server` (the default, without `/mcp`, will not match). `<public url>` is the Codespaces port-8080 address (set to Public) or a tunnel URL; plain `http://localhost:8080/mcp` only works for local checks. See `task.md` Step 5c.
- Scope names are exact: `oyster.use`, not `oyster:use`.
- `/health` is deliberately unauthenticated (also served at `/mcp/health`). CORS for `xaa.dev` is already set up.
- Port 8080 may be held by a stale server from an earlier run (`lsof -nP -iTCP:8080 -sTCP:LISTEN`); it serves old code, so restart it before testing.

## Keep the step markers
- `task.md` links to `STEP n` / `TODO` comments in `server/auth.js` and `server/app.js`. When implementing a step, **write the code below or beside the marker and keep the comment text**; never delete or rewrite it. You may append `// DONE` to the marker line. Developers use these markers to find their way back from `task.md`.

## Working here
- Use `jose` for JWT verification and the `@modelcontextprotocol/*` SDK helpers; don't hand-roll either.
- Registration values for the xaa.dev wizard are in `task.md` Step 6. You cannot drive the wizard yourself: print the values for the human (see 5b).
