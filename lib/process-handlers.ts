import { logger } from './logger';

// Top-level process safety net. Runs once when imported. Long-lived Next.js
// server processes need these so an async leak doesn't silently kill the
// container with no log line.

let installed = false;

export function installProcessHandlers() {
  if (installed) return;
  installed = true;

  process.on('unhandledRejection', (reason: unknown) => {
    logger.fatal({ err: reason }, 'unhandledRejection');
  });

  process.on('uncaughtException', (err: Error) => {
    // The process is in an undefined state. Log and exit so the supervisor
    // (docker, systemd, k8s) restarts cleanly. Holding the process alive
    // after an uncaught exception leads to subtle data corruption.
    logger.fatal({ err }, 'uncaughtException, exiting');
    setTimeout(() => process.exit(1), 250).unref();
  });

  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, () => {
      logger.info({ sig }, 'received shutdown signal');
      // Next.js owns the HTTP listener; we don't need to call server.close
      // here. Logging the signal makes it visible to log shippers.
    });
  }
}
