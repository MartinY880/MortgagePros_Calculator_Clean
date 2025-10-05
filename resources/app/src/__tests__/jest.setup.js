// Global Jest setup for test environment tweaks.
// Silence jsdom not-implemented window.scrollTo errors by overriding with a no-op.
if (typeof window !== "undefined") {
  window.scrollTo = () => {};
}
