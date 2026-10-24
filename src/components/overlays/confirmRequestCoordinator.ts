type ActiveRequest = {
  id: number;
  settled: boolean;
  resolve: (confirmed: boolean) => void;
};

export function createConfirmRequestCoordinator() {
  let sequence = 0;
  let active: ActiveRequest | null = null;
  let emitter: ((id: number) => void) | null = null;

  const settle = (id: number, confirmed: boolean) => {
    if (!active || active.id !== id || active.settled) return false;
    active.settled = true;
    const request = active;
    active = null;
    request.resolve(confirmed);
    return true;
  };

  return {
    create() {
      if (active) settle(active.id, false);
      const id = ++sequence;
      let resolve!: (confirmed: boolean) => void;
      const result = new Promise<boolean>((done) => { resolve = done; });
      active = { id, settled: false, resolve };
      emitter?.(id);
      return { id, result };
    },
    settle,
    mount(nextEmitter: (id: number) => void) {
      emitter = nextEmitter;
      return () => {
        if (active) settle(active.id, false);
        if (emitter === nextEmitter) emitter = null;
      };
    },
  };
}
