import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { LangProvider } from '../../src/i18n/react';

/** Monta un componente con l'interfaccia in italiano (i test dei singoli componenti sono scritti in italiano). */
export const renderIt = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { ...options, wrapper: ({ children }: { children: ReactNode }) => <LangProvider lang="it">{children}</LangProvider> });
