// Runs synchronously before first paint so dark-mode users don't see a flash
// of light. Loaded via <script src> from app/layout.tsx — keep this file
// pure ES5, no imports, no top-level await.
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = saved === 'dark' || (saved === 'system' && prefers);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) { /* ignore */ }
})();
