// Next.js calls this once per worker on startup. Use it to install the
// long-lived process-level safety net.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installProcessHandlers } = await import('./lib/process-handlers');
    installProcessHandlers();
  }
}
