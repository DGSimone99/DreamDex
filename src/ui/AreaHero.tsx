import type { ReactNode } from 'react';

/**
 * La riga del team in cima alle schede dell'Analisi (Generale, Coverage, Meta, Sostenibilità): la targa col nome, la
 * lettera del voto se c'è (solo per gli occhi: il voto lo dice già la testata dell'area), poi il contenuto.
 */
export function AreaHero({ label, grade, className, children }: {
  label: string;
  grade?: { grade: string; label: string } | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`og-hero${className ? ` ${className}` : ''}`} aria-label={label}>
      <span className="og-plate">{label}</span>
      {grade && <span className={`og-hero-grade grade-${grade.grade}`} aria-hidden="true"><b>{grade.grade}</b> {grade.label}</span>}
      {children}
    </section>
  );
}

/** "12/18 coperti": il numero grande (nel colore di `tone`), il totale piccolo, poi le parole. */
export function HeroCount({ n, of, tone, children }: { n: number; of: number; tone: string; children: ReactNode }) {
  return <p className="og-hero-line"><b className={tone}>{n}</b><small>/{of}</small> {children}</p>;
}
