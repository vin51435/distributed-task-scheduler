import * as net from 'net';

const host = process.env.POSTGRES_HOST || 'localhost';
const port = Number(process.env.POSTGRES_PORT) || 5432;
const maxAttempts = 30;
let attempts = 0;

function checkConnection(): void {
  attempts++;
  const socket = new net.Socket();

  socket.setTimeout(2000);

  socket.on('connect', () => {
    console.log(`✅ PostgreSQL is ready on ${host}:${port}`);
    socket.destroy();
    process.exit(0);
  });

  socket.on('timeout', () => {
    socket.destroy();
    retry();
  });

  socket.on('error', () => {
    socket.destroy();
    retry();
  });

  socket.connect(port, host);
}

function retry(): void {
  if (attempts >= maxAttempts) {
    console.error(
      `❌ Could not connect to PostgreSQL on ${host}:${port} after ${maxAttempts} attempts.`,
    );
    process.exit(1);
  }
  setTimeout(checkConnection, 1000);
}

console.log(`Waiting for PostgreSQL on ${host}:${port}...`);
checkConnection();
