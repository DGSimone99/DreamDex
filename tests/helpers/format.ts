import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/**
 * La finestra "Scegli il formato" (dalla fascia del formato nella barra): pulsanti radio per famiglia, generazione,
 * lotta, tier, gioco e limite di generazione. Ogni funzione apre la finestra se è chiusa.
 */
export async function openFormat(user: UserEvent): Promise<void> {
  if (screen.queryByRole('dialog', { name: 'Scegli il formato' })) return;
  await user.click(screen.getByRole('button', { name: /^Formato / }));
}
const radio = (name: string, value: string) => {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
  if (!input) throw new Error(`Nessuna scelta ${name}=${value}`);
  return input;
};
const pick = async (user: UserEvent, name: string, value: string) => {
  await openFormat(user);
  await user.click(radio(name, value));
};
/** Pokédex di prima: 'gen9' e 'natdex' sono generazioni Smogon, 'nolimits' è No Format. */
export async function chooseDex(user: UserEvent, id: 'gen9' | 'natdex' | 'nolimits' | string): Promise<void> {
  if (id === 'nolimits') return pick(user, 'format-family', 'free');
  await pick(user, 'format-family', 'competitive');
  await user.click(radio('format-gen', id === 'gen9' ? '9' : 'natdex'));
}
export const chooseTier = (user: UserEvent, id: string) => pick(user, 'format-tier', id);
export const chooseBattle = (user: UserEvent, id: 'singles' | 'doubles') => pick(user, 'format-battle', id);
/** Limite di generazione: c'è solo in No Format. */
export async function chooseGen(user: UserEvent, gen: string | number): Promise<void> {
  await pick(user, 'format-family', 'free');
  await user.click(radio('format-genlimit', String(gen)));
}
export const chooseGame = (user: UserEvent, id: string) => pick(user, 'format-family', 'game').then(() => user.click(radio('format-game', id)));
/** Il valore scelto ('format-tier', 'format-gen', 'format-genlimit'…), con la finestra aperta. */
export const chosen = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? null;
/** I nomi dei tier fra cui scegliere, in ordine, con la finestra aperta. */
export const tierNames = () => [...document.querySelectorAll<HTMLInputElement>('input[name="format-tier"]')].map(input => input.closest('label')!.textContent!.trim());
