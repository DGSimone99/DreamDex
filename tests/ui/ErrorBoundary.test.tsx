import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';

function Broken(): never {
  throw new Error('rotto');
}

afterEach(() => { document.documentElement.lang = ''; vi.restoreAllMocks(); });

describe('ErrorBoundary', () => {
  it('senza errori mostra l’app com’è', () => {
    render(<ErrorBoundary><p>app</p></ErrorBoundary>);
    expect(screen.getByText('app')).toBeInTheDocument();
  });

  it('un errore imprevisto non lascia la pagina vuota: lo dice e Ricarica ricarica la pagina', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location);
    document.documentElement.lang = 'it';
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Qualcosa è andato storto');
    expect(screen.getByRole('alert')).toHaveTextContent('Il tuo team è salvato');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ricarica' }));
    expect(reload).toHaveBeenCalled();
  });

  it('in inglese se l’app era in inglese', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    document.documentElement.lang = 'en';
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
