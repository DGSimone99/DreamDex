import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';

describe('App', () => {
  it('mostra il titolo', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'DreamDex' })).toBeInTheDocument();
  });
});
