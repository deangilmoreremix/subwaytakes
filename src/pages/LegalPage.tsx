import { Link, Navigate, useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { LEGAL_DOCS, LEGAL_DRAFT_NOTICE, legalDoc } from '../lib/legal/documents';

/** The links shown in footers: public pages, reachable without signing in. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500 ${className}`}>
      {LEGAL_DOCS.map(d => <Link key={d.slug} to={`/${d.slug}`} className="hover:text-zinc-200 hover:underline">{d.title}</Link>)}
    </nav>
  );
}

/** One legal page, by route (/terms, /privacy, /refunds, /ai-policy). */
export function LegalPage({ slug: forced }: { slug?: string }) {
  const params = useParams();
  const doc = legalDoc(forced ?? params.slug ?? '');
  if (!doc) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-ink-900 px-5 py-8 text-zinc-200">
      <Link to="/" className="text-[12px] text-accent underline">Back to the studio</Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">{doc.title}</h1>
      <p className="mt-1 text-[13px] text-zinc-500">{doc.summary}</p>
      <p role="note" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-[12px] text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{LEGAL_DRAFT_NOTICE}</p>
      <div className="mt-6 space-y-6">
        {doc.sections.map(s => (
          <section key={s.heading}>
            <h2 className="font-display text-[16px] font-semibold text-white">{s.heading}</h2>
            {s.body.map((p, i) => <p key={i} className="mt-2 text-[14px] leading-relaxed text-zinc-300">{p}</p>)}
          </section>
        ))}
      </div>
      <LegalLinks className="mt-10 border-t border-line pt-4" />
    </div>
  );
}
