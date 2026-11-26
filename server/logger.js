// Logs one line per request, after it finishes: status, time, the MCP call, and who made it.
// Never prints the token itself.
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const rpc = req.body && typeof req.body === 'object' ? req.body : {};
    const call = rpc.method ? ` ${rpc.method}${rpc.params?.name ? `(${rpc.params.name})` : ''}` : '';
    const who = req.auth?.extra?.sub ?? (req.headers.authorization ? 'unverified token' : 'no token');
    const challenge = res.statusCode >= 400 ? ` ${res.getHeader('www-authenticate') ?? ''}`.trimEnd() : '';
    const time = new Date().toISOString().slice(11, 23);
    console.log(`${time} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms${call} [${who}]${challenge}`);
  });
  next();
}
