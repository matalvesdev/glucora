import { useEffect, useState } from 'react';
import { Value } from '@sinclair/typebox/value';
import { MeSchema, TimelineListSchema } from '@glucora/contracts';

type Access = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
type Timeline = {
  state: 'empty' | 'ready';
  groups: readonly {
    local_date: string;
    items: readonly {
      id: string;
      source_kind: string;
      source_type: string;
      fact_class: string;
      category: { system: string; code: string };
      occurred_at: string;
    }[];
  }[];
};

function label(item: Timeline['groups'][number]['items'][number]) {
  if (
    item.category.system === 'http://loinc.org' &&
    item.category.code === '2339-0'
  )
    return 'Medição de glicose';
  return `${item.source_kind} · ${item.category.code}`;
}

export function OwnTimeline() {
  const [access, setAccess] = useState<Access>('loading');
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const me = await fetch('/v1/me', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const meBody: unknown = await me.json();
        if (me.status === 401 || me.status === 403)
          return setAccess('unauthenticated');
        if (!me.ok || !Value.Check(MeSchema, meBody)) return setAccess('error');
        setAccess('authenticated');
        const response = await fetch('/v1/timeline?limit=20', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const body: unknown = await response.json();
        if (!response.ok || !Value.Check(TimelineListSchema, body))
          return setAccess('error');
        setTimeline(body as Timeline);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setAccess('error');
      }
    })();
    return () => controller.abort();
  }, []);
  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12 md:py-20">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-800">
        Sua história
      </p>
      <h1 className="mt-4 text-4xl font-medium tracking-tight md:text-5xl">
        Timeline
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
        Registros organizados pelo dia em que foram informados. Esta tela não
        produz diagnóstico, alerta ou recomendação.
      </p>
      <div
        role="status"
        aria-live="polite"
        className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 text-stone-700"
      >
        {access === 'loading'
          ? 'Carregando sua timeline…'
          : access === 'unauthenticated'
            ? 'Entre na sua conta e autorize a finalidade de autocuidado para consultar sua timeline.'
            : access === 'error'
              ? 'Não foi possível carregar sua timeline agora.'
              : null}
      </div>
      {access === 'authenticated' && timeline?.state === 'empty' ? (
        <p className="mt-8 text-sm text-stone-600">
          Ainda não há registros na timeline. Isso não significa que algo não
          aconteceu.
        </p>
      ) : null}
      {access === 'authenticated' && timeline?.state === 'ready' ? (
        <div className="mt-8 space-y-8">
          {timeline.groups.map((group) => (
            <section
              key={group.local_date}
              className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm"
            >
              <h2 className="text-xl font-semibold">
                {new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'long',
                  timeZone: 'UTC',
                }).format(new Date(`${group.local_date}T12:00:00Z`))}
              </h2>
              <ul className="mt-4 space-y-3">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <p className="font-semibold">{label(item)}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {new Intl.DateTimeFormat('pt-BR', {
                        timeStyle: 'short',
                      }).format(new Date(item.occurred_at))}{' '}
                      · origem: {item.source_type} · classe: {item.fact_class}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </main>
  );
}
