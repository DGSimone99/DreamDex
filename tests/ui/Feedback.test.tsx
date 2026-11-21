import { render, screen } from '@testing-library/react';
import { DEFAULT_CHOICE } from '../../src/engine/formatChoice';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { LangProvider } from '../../src/i18n/react';
import { FeedbackDialog, ISSUES_URL } from '../../src/ui/FeedbackDialog';

const team = [{ ...emptySet('Great Tusk'), moves: ['Rapid Spin', '', '', ''] }];
const ok = () => vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })) as unknown as typeof fetch;

function open(props: Partial<Parameters<typeof FeedbackDialog>[0]> = {}) {
  const onClose = vi.fn();
  render(<LangProvider lang="it"><FeedbackDialog team={team} choice={DEFAULT_CHOICE} onClose={onClose} accessKey="test-key" send={ok()} {...props} /></LangProvider>);
  return onClose;
}

describe('Segnala o suggerisci', () => {
  it('invia tipo, messaggio, email e il team come link; poi il grazie', async () => {
    const user = userEvent.setup();
    const send = ok();
    open({ send });
    const button = screen.getByRole('button', { name: 'Invia' });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Voto strano' }));
    await user.type(screen.getByRole('textbox', { name: 'Messaggio' }), 'Il voto di Tusk è basso');
    await user.type(screen.getByRole('textbox', { name: 'Email (facoltativa)' }), 'a@b.it');
    await user.click(button);
    expect(await screen.findByText('Grazie, ricevuto!')).toBeInTheDocument();
    const body = JSON.parse((send as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].body as string);
    expect(body).toMatchObject({ access_key: 'test-key', tipo: 'grade', messaggio: 'Il voto di Tusk è basso', email: 'a@b.it', formato: DEFAULT_FORMAT.formatId });
    expect(body.team).toContain('#team=');
  });

  it('senza allegare il team non manda il link; se l\'invio fallisce propone GitHub', async () => {
    const user = userEvent.setup();
    const send = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    open({ send });
    await user.click(screen.getByRole('checkbox', { name: /Allega il mio team/ }));
    await user.type(screen.getByRole('textbox', { name: 'Messaggio' }), 'Ciao');
    await user.click(screen.getByRole('button', { name: 'Invia' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non sono riuscito a inviarlo');
    const body = JSON.parse((send as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].body as string);
    expect(body.team).toBeUndefined();
  });

  it('senza la chiave del servizio resta solo il link a GitHub', () => {
    open({ accessKey: '' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('link', { name: 'apri una segnalazione su GitHub' })).toHaveAttribute('href', ISSUES_URL);
  });
});
