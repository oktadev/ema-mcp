import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const SERVER_URL = process.env.MCP_URL ?? 'http://localhost:8080/mcp';

const client = new Client({ name: 'tube-companion-client', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(SERVER_URL)));

const { tools } = await client.listTools();
console.log(`Connected to ${SERVER_URL}. Tools:`);
for (const tool of tools) console.log(`  ${tool.name}: ${tool.description}`);

const status = await client.callTool({ name: 'line_status', arguments: { line: 'Jubilee' } });
console.log('\nline_status(Jubilee):');
console.log(status.content[0].text);

await client.close();
