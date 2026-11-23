type Invalidator = () => void;

let invalidator: Invalidator | null = null;

export function registerPrivateContextInvalidator(callback: Invalidator): void {
  invalidator = callback;
}

export function invalidatePrivateContext(): void {
  invalidator?.();
}
