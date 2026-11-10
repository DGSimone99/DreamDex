import type { UserEvent } from '@testing-library/user-event';

/** Le scelte del menu Formato (barra laterale): pulsanti radio per Pokédex, tier e generazione. */
const radio = (name: string, value: string) => {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
  if (!input) throw new Error(`Nessuna scelta ${name}=${value}`);
  return input;
};
export const chooseDex = (user: UserEvent, id: string) => user.click(radio('format-dex', id));
export const chooseTier = (user: UserEvent, id: string) => user.click(radio('format-tier', id));
export const chooseGen = (user: UserEvent, gen: string | number) => user.click(radio('format-gen', String(gen)));
/** Il valore scelto: 'format-dex', 'format-tier' o 'format-gen'. */
export const chosen = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? null;
/** I nomi dei tier fra cui scegliere, in ordine. */
export const tierNames = () => [...document.querySelectorAll<HTMLInputElement>('input[name="format-tier"]')].map(input => input.closest('label')!.textContent!.trim());
