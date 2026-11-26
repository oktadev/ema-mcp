import readline from 'node:readline/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const SERVER_URL = process.env.MCP_URL ?? 'http://localhost:8080/mcp';
// Once your server requires a token, pass one in: MCP_TOKEN=<access token> npm run client
const TOKEN = process.env.MCP_TOKEN;

const client = new Client({ name: 'tube-companion-client', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(SERVER_URL), {
    requestInit: TOKEN ? { headers: { authorization: `Bearer ${TOKEN}` } } : undefined,
  }));

const { tools } = await client.listTools();
console.log(`Connected to ${SERVER_URL}\n`);
const showTools = () => tools.forEach((t) => console.log(`  ${t.name}: ${t.description}`));

console.log('Tools:');
showTools();
console.log('\nCommands:  tools  |  call <tool> [json args]  |  quit');
console.log('Example:   call line_status {"line":"Jubilee"}\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
while (true) {
  const line = (await rl.question('mcp> ').catch(() => 'quit')).trim();
  if (!line) continue;
  if (line === 'quit' || line === 'exit') break;
  if (line === 'tools') {
    showTools();
    continue;
  }
  const match = line.match(/^call\s+(\S+)\s*(.*)$/s);
  if (!match) {
    console.log('Unknown command. Try: tools | call <tool> [json args] | quit');
    continue;
  }
  try {
    const args = match[2] ? JSON.parse(match[2]) : {};
    const result = await client.callTool({ name: match[1], arguments: args });
    console.log(result.content.map((c) => c.text ?? JSON.stringify(c)).join('\n'));
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
}

rl.close();
await client.close();
