// Serialize immutable snapshots; edits made during a write remain queued.
export function createAutosave({ save, onSaved = () => {}, onState = () => {} }) {
  let revision = 0, savedRevision = 0, latest, timer, running = false, error = null, disposed = false;
  const state = () => ({ pending: revision !== savedRevision, saving: running, error });
  const publish = () => onState(state());
  async function flush() {
    clearTimeout(timer);
    if (disposed || running || revision === savedRevision || error) return;
    running = true;
    publish();
    while (!disposed && revision !== savedRevision && !error) {
      const version = revision;
      const snapshot = latest;
      try {
        const result = await save(snapshot);
        savedRevision = version;
        onSaved(snapshot, result);
      } catch (cause) { error = cause; }
    }
    running = false;
    publish();
  }
  return {
    schedule(snapshot, delay = 0) {
      if (disposed) return;
      latest = structuredClone(snapshot);
      revision++;
      clearTimeout(timer);
      publish();
      if (!error) {
        if (delay) timer = setTimeout(flush, delay);
        else void flush();
      }
    },
    retry() { error = null; void flush(); },
    state,
    dispose() { disposed = true; clearTimeout(timer); },
  };
}
