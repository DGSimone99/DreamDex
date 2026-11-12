import { vi } from 'vitest';

/** Appunti finti (da chiamare dopo userEvent.setup(), che mette i suoi): restituisce l'ultimo testo copiato. */
export function spyClipboard(): () => string {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return () => String(writeText.mock.calls.at(-1)?.[0] ?? '');
}
