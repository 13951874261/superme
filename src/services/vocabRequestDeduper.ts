export function createRequestDeduper() {
  const pending = new Map<string, Promise<unknown>>();

  return {
    run<T>(key: string, request: () => Promise<T>): Promise<T> {
      const existing = pending.get(key);
      if (existing) return existing as Promise<T>;

      const promise = request().finally(() => {
        pending.delete(key);
      });
      pending.set(key, promise);
      return promise;
    },
  };
}
