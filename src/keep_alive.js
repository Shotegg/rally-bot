import http from 'node:http';

export function startKeepAlive() {
  const port = Number(process.env.PORT);
  if (!port) return;

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  });

  server.listen(port, () => {
    console.log(`Keep-alive server listening on ${port}`);
  });
}
