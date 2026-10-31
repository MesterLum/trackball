// Served only in development. Keep configurator options in the existing URL.
(() => {
  let current, pending;
  async function check() {
    try {
      const response = await fetch('/__dev__/revision', { cache: 'no-store' });
      if (response.ok) {
        const { revision } = await response.json();
        if (!current) current = revision;
        if (revision !== current) {
          // Wait for two matching polls so a save/restart can finish first.
          if (pending === revision) { location.reload(); return; }
          pending = revision;
        } else pending = undefined;
      }
    } catch (_) { /* Retry while Uvicorn is restarting. */ }
    setTimeout(check, 1000);
  }
  check();
})();
