import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/**
 * La finestra "Scegli il formato" (dalla targa del formato nella barra): pulsanti radio per famiglia, generazione,
 * lotta, tier, gioco e limite di generazione. Ogni funzione choose* apre la finestra se è chiusa, sceglie e conferma
 * (il formato cambia solo con Conferma, che chiude la finestra). `chosen` e `tierNames` leggono la finestra aperta.
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
/** Conferma la finestra aperta col pulsante «Usa <formato>» (il formato cambia e la finestra si chiude). */
// Nella finestra vera (dopo una chiusura resta un attimo la sua copia ferma, nascosta, per l'animazione)
export const confirmFormat = (user: UserEvent) =>
  user.click(screen.getByRole('dialog', { name: 'Scegli il formato' }).querySelector<HTMLElement>('.fmt-actions .fmt-main')!);
const pick = async (user: UserEvent, name: string, value: string) => {
  await openFormat(user);
  await user.click(radio(name, value));
  await confirmFormat(user);
};
/** Pokédex di prima: 'gen9' e 'natdex' sono generazioni Smogon, 'nolimits' è No Format. */
export async function chooseDex(user: UserEvent, id: 'gen9' | 'natdex' | 'nolimits' | string): Promise<void> {
  if (id === 'nolimits') return pick(user, 'format-family', 'free');
  await openFormat(user);
  await user.click(radio('format-family', 'competitive'));
  await user.click(radio('format-gen', id === 'gen9' ? '9' : 'natdex'));
  await confirmFormat(user);
}
export const chooseTier = (user: UserEvent, id: string) => pick(user, 'format-tier', id);
export const chooseBattle = (user: UserEvent, id: 'singles' | 'doubles') => pick(user, 'format-battle', id);
/** Limite di generazione: c'è solo in No Format. */
export async function chooseGen(user: UserEvent, gen: string | number): Promise<void> {
  await openFormat(user);
  await user.click(radio('format-family', 'free'));
  await user.click(radio('format-genlimit', String(gen)));
  await confirmFormat(user);
}
export async function chooseGame(user: UserEvent, id: string): Promise<void> {
  await openFormat(user);
  await user.click(radio('format-family', 'game'));
  await user.click(radio('format-game', id));
  await confirmFormat(user);
}
/** Il valore scelto ('format-tier', 'format-gen', 'format-genlimit'…), con la finestra aperta. */
export const chosen = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? null;
/** I nomi dei tier fra cui scegliere, in ordine, con la finestra aperta. */
export const tierNames = () => [...document.querySelectorAll<HTMLInputElement>('input[name="format-tier"]')].map(input => input.closest('label')!.textContent!.trim());
