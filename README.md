# Tube Companion MCP Lab

A hands-on lab: a London Tube MCP server and a minimal client. The server starts with no authentication.

```
mcp-lab/
├── server/   MCP server (Express, Streamable HTTP)
└── client/   Minimal MCP client
```

## Prerequisites

- **Node.js 22.12 or newer** (22 LTS). Check with `node -v`.
  `npm install` fails with a clear error on older versions.

## Run

```sh
npm install                # installs both workspaces
npm run dev                # starts the server, runs the client against it, stops the server
PORT=9090 npm run dev      # same, on another port (default 8080)
```

Or run them separately, in two terminals:

```sh
npm run server             # http://localhost:8080/mcp  (PORT=9090 npm run server for another port)
npm run client             # lists tools and calls one  (MCP_URL=http://localhost:9090/mcp npm run client)
```
