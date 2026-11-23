type Invalidator = () => void | Promise<void>;

let invalidator: Invalidator | null = null;

export function registerPrivateContextInvalidator(callback: Invalidator): void {
  invalidator = callback;
}

export async function invalidatePrivateContext(): Promise<void> {
  await invalidator?.();
}
