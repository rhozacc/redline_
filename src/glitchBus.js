/* Tiny pub/sub so the background particles can react to the title's glitch
 * bursts. The title is the scheduler; it emits a burst duration, anyone
 * interested (the particle field) listens and reacts for that window. */
const subs = new Set();

export const glitchBus = {
  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
  emit(durationMs) {
    subs.forEach((fn) => fn(durationMs));
  },
};
