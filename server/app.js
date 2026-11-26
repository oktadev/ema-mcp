import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/server';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { LINES, STATIONS, SLANG, planJourney, fareFor, lineStatus, translateSlang } from './london.js';
// SCOPES.READ = 'tube.read', SCOPES.OYSTER = 'oyster.use'
import { SCOPES } from './auth.js';
import { requestLogger } from './logger.js';

// STEP 5 (TODO): this is one Oyster card for the whole world. Replace it with one card per traveller.
const oyster = { balancePence: 1500, history: [] };

// The xaa.dev tester calls this server from the browser, so it must allow cross-origin requests.
const CORS_ORIGINS = ['https://xaa.dev', 'https://app.xaa.dev'];
const cors = (req, res, next) => {
  if (CORS_ORIGINS.includes(req.headers.origin)) {
    res.set({
      'Access-Control-Allow-Origin': req.headers.origin,
      'Access-Control-Allow-Headers': 'authorization, content-type, accept, mcp-protocol-version, mcp-session-id',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
      'Access-Control-Allow-Private-Network': 'true', // lets an https page reach http://localhost
      Vary: 'Origin',
    });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
};

const pounds = (pence) => `£${(pence / 100).toFixed(2)}`;
const asText = (value) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});
const asError = (message) => ({ ...asText(message), isError: true });

function createMcpServer() {
  const server = new McpServer({ name: 'tube-companion', version: '1.0.0' });

  // --- Public info: any valid token ------------------------------------------

  server.registerTool(
    'line_status',
    {
      description: 'Current service status for a Tube line, or every line if none is given',
      inputSchema: z.object({ line: z.string().optional().describe('e.g. Jubilee, Central, Elizabeth line') }),
    },
    async ({ line }) => {
      const names = Object.keys(LINES).map((l) => l.replace(/ \(.*\)$/, ''));
      const unique = [...new Set(names)];
      const wanted = line ? unique.filter((l) => l.toLowerCase().includes(line.toLowerCase())) : unique;
      if (!wanted.length) return asError(`Unknown line "${line}". Try: ${unique.join(', ')}`);
      return asText(Object.fromEntries(wanted.map((l) => [l, lineStatus(l)])));
    },
  );

  server.registerTool(
    'plan_journey',
    {
      description: 'Plan a Tube journey between two stations, with interchanges and fare',
      inputSchema: z.object({
        from: z.string().describe('Start station, e.g. "Heathrow"'),
        to: z.string().describe('End station, e.g. "Stratford"'),
      }),
    },
    async ({ from, to }) => {
      const journey = planJourney(from, to);
      if (!journey) {
        return asError(`Couldn't find a route from "${from}" to "${to}". Known stations: ${STATIONS.join(', ')}`);
      }
      return asText({ ...journey, fare: pounds(fareFor(journey)) });
    },
  );

  server.registerTool(
    'cockney_translator',
    {
      description: 'Translate a piece of Cockney rhyming slang',
      inputSchema: z.object({ phrase: z.string().describe('e.g. "apples and pears"') }),
    },
    async ({ phrase }) => {
      const meaning = translateSlang(phrase);
      return meaning
        ? asText(`"${phrase}" means ${meaning}`)
        : asError(`Never heard of it, guv'nor. I know: ${Object.keys(SLANG).join(', ')}`);
    },
  );

  // --- Personal: these should only work for the logged-in traveller ---------
  // STEP 4 (TODO): require the oyster.use scope on all four tools below.
  // STEP 5 (TODO): use the calling traveller's card instead of the global `oyster`.

  server.registerTool('oyster_balance', { description: 'Check the Oyster card balance' }, async () =>
    asText({ balance: pounds(oyster.balancePence) }),
  );

  server.registerTool(
    'top_up_oyster',
    {
      description: 'Add money to the Oyster card',
      inputSchema: z.object({ amount: z.number().min(1).max(50).describe('Amount in pounds, £1 to £50') }),
    },
    async ({ amount }) => {
      oyster.balancePence += Math.round(amount * 100);
      return asText({ balance: pounds(oyster.balancePence) });
    },
  );

  server.registerTool(
    'book_journey',
    {
      description: 'Take a journey: plans the route and charges the Oyster card',
      inputSchema: z.object({ from: z.string(), to: z.string() }),
    },
    async ({ from, to }) => {
      const journey = planJourney(from, to);
      if (!journey) return asError(`Couldn't find a route from "${from}" to "${to}".`);
      const fare = fareFor(journey);
      if (fare > oyster.balancePence) {
        return asError(`Insufficient funds: fare is ${pounds(fare)}, balance is ${pounds(oyster.balancePence)}.`);
      }
      oyster.balancePence -= fare;
      oyster.history.push({ at: new Date().toISOString(), from: journey.from, to: journey.to, fare: pounds(fare) });
      return asText({ journey, charged: pounds(fare), balance: pounds(oyster.balancePence) });
    },
  );

  server.registerTool('travel_history', { description: 'List journeys taken on the Oyster card' }, async () =>
    asText(oyster.history.length ? oyster.history : 'No journeys yet.'),
  );

  return server;
}

/**
 * @param {object} config
 * @param {string} config.resourceUrl  Public URL of this server, exactly as registered in xaa.dev.
 * @param {object} config.authServerMetadata  RFC 8414 metadata of the Authorization Server.
 * @param {{ verifyAccessToken(token: string): Promise<object> }} config.verifier  From auth.js.
 * @param {string[]} [config.allowedHosts]  Host headers to accept (DNS rebinding protection).
 */
export function createApp({ resourceUrl, authServerMetadata, verifier, allowedHosts = ['localhost', '127.0.0.1'] }) {
  const resourceServerUrl = new URL(resourceUrl);

  const app = createMcpExpressApp({ host: '0.0.0.0', allowedHosts });
  app.use(requestLogger);
  app.use(cors);

  // The registration wizard's health check. Unauthenticated on purpose.
  // Also served under /mcp because the wizard may resolve the health path against the MCP URL.
  app.get(['/health', '/mcp/health'], (_req, res) => res.json({ status: 'ok' }));

  // STEP 2 (TODO): publish /.well-known/oauth-protected-resource so agents can discover the Authorization Server.
  //   Hint: app.use(mcpAuthMetadataRouter({ oauthMetadata: authServerMetadata, resourceServerUrl,
  //                  scopesSupported: Object.values(SCOPES), resourceName: 'Tube Companion' }))
  //   from '@modelcontextprotocol/express'.

  // STEP 3 (TODO): create `authenticate` with requireBearerAuth (from '@modelcontextprotocol/express'):
  //   { verifier, expectedResource: resourceServerUrl, requiredScopes: [SCOPES.READ],
  //     resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl) }
  //   getOAuthProtectedResourceMetadataUrl comes from '@modelcontextprotocol/server'.
  //   Then put it in front of POST /mcp below.

  // Stateless StreamableHTTP: a fresh server + transport per request.
  app.post('/mcp', async (req, res) => {
    const server = createMcpServer();
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Stateless mode has no server-initiated stream or session to delete.
  const methodNotAllowed = (_req, res) =>
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  app.get('/mcp', methodNotAllowed);
  app.delete('/mcp', methodNotAllowed);

  return app;
}
