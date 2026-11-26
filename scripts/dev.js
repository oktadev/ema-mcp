// Starts the server, waits for it to accept connections, runs the client against it, then stops the server.
import { spawn } from 'node:child_process';
import net from 'node:net';

const port = Number(process.env.PORT ?? 8080);
const env = { ...process.env, PORT: String(port), MCP_URL: `http://localhost:${port}/mcp` };

const server = spawn('npm', ['start', '-w', 'server'], { env, stdio: 'inherit' });
const stop = (code) => {
  server.kill();
  process.exit(code);
};
server.on('exit', (code) => process.exit(code ?? 1));
process.on('SIGINT', () => stop(130));

const isUp = () =>
  new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1').once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });

for (let i = 0; i < 50 && !(await isUp()); i++) await new Promise((r) => setTimeout(r, 200));
if (!(await isUp())) {
  console.error(`Server did not start on port ${port}`);
  stop(1);
}

const client = spawn('npm', ['start', '-w', 'client'], { env, stdio: 'inherit' });
client.on('exit', (code) => stop(code ?? 1));
