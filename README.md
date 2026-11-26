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
npm run dev                # starts the server and an interactive client; type quit to stop both
PORT=9090 npm run dev      # same, on another port (default 8080)
```

In the client prompt:

```
mcp> tools
mcp> call line_status {"line":"Jubilee"}
mcp> call oyster_balance
mcp> quit
```

Or run them separately, in two terminals:

```sh
npm run server             # http://localhost:8080/mcp  (PORT=9090 npm run server for another port)
npm run client             # MCP_URL=http://localhost:9090/mcp npm run client
```
