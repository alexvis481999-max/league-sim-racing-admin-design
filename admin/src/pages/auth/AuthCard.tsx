import type { ReactNode } from 'react';
import './auth.v16.css';

/** Centered sign-in card on the v16 background with the brand mark. */
export function AuthCard({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="lsr-auth">
      <section className="lsr-auth-card" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="lsr-auth-brand"><span className="lsr-brandmark">LSR</span><span>LEAGUE SIM RACING</span></div>
        <h1>{title}</h1>
        {description && <p className="lsr-auth-desc">{description}</p>}
        <div className="lsr-auth-body">{children}</div>
      </section>
    </main>
  );
}
