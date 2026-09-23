import { useEffect, useState, type FormEvent } from 'react';
import { Value } from '@sinclair/typebox/value';
import {
  ManualGlucoseObservationListSchema,
  ManualGlucoseObservationSchema,
  MeSchema,
} from '@glucora/contracts';
import { Button } from '@glucora/ui';

type AccessState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
type SubmitState = 'idle' | 'loading' | 'success' | 'error';

function currentLocalInput(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function observedTime(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function ManualGlucoseCapture() {
  const [access, setAccess] = useState<AccessState>('loading');
  const [decimalValue, setDecimalValue] = useState('');
  const [occurredAt, setOccurredAt] = useState(currentLocalInput);
  const [submit, setSubmit] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<
    readonly {
      id: string;
      decimal_value: string;
      occurred_at: string;
      version: number;
    }[]
  >([]);
  const [historyState, setHistoryState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [correction, setCorrection] = useState<{
    id: string;
    version: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/v1/me', {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          setAccess('unauthenticated');
          return;
        }
        const body: unknown = await response.json();
        setAccess(
          response.ok && Value.Check(MeSchema, body)
            ? 'authenticated'
            : 'error',
        );
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setAccess('error');
      });
    return () => controller.abort();
  }, []);

  async function loadHistory() {
    setHistoryState('loading');
    try {
      const response = await fetch('/v1/observations?limit=20', {
        credentials: 'include',
        cache: 'no-store',
      });
      const body: unknown = await response.json();
      if (
        !response.ok ||
        !Value.Check(ManualGlucoseObservationListSchema, body)
      ) {
        setHistoryState('error');
        return;
      }
      setHistory(
        (
          body as {
            items: {
              id: string;
              decimal_value: string;
              occurred_at: string;
              version: number;
            }[];
          }
        ).items,
      );
      setHistoryState('ready');
    } catch {
      setHistoryState('error');
    }
  }

  async function correct(event: FormEvent) {
    event.preventDefault();
    if (!correction) return;
    const normalized = decimalValue.replace(',', '.');
    const occurred = observedTime(occurredAt);
    if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,9})?$/.test(normalized) || !occurred)
      return;
    setSubmit('loading');
    try {
      const response = await fetch(`/v1/observations/${correction.id}`, {
        method: 'PUT',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          expected_version: correction.version,
          decimal_value: normalized,
          occurred_at: occurred,
          observed_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          utc_offset_minutes: -new Date(occurred).getTimezoneOffset(),
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(ManualGlucoseObservationSchema, body))
        throw new Error('invalid');
      setCorrection(null);
      setSubmit('success');
      setMessage(
        'Medição corrigida; a versão anterior foi preservada no histórico.',
      );
      await loadHistory();
    } catch {
      setSubmit('error');
      setMessage(
        'Não foi possível corrigir agora. Tente novamente em instantes.',
      );
    }
  }

  useEffect(() => {
    if (access === 'authenticated') void loadHistory();
  }, [access]);

  async function record(event: FormEvent) {
    event.preventDefault();
    const normalized = decimalValue.replace(',', '.');
    const occurred = observedTime(occurredAt);
    if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,9})?$/.test(normalized) || !occurred) {
      setSubmit('error');
      setMessage('Informe uma medição e um momento válidos.');
      return;
    }
    setSubmit('loading');
    setMessage('');
    try {
      const response = await fetch('/v1/observations', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          decimal_value: normalized,
          occurred_at: occurred,
          observed_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          utc_offset_minutes: -new Date(occurred).getTimezoneOffset(),
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(ManualGlucoseObservationSchema, body)) {
        setSubmit('error');
        setMessage(
          'Não foi possível registrar agora. Tente novamente em instantes.',
        );
        return;
      }
      setSubmit('success');
      setDecimalValue('');
      setMessage('Medição registrada sem interpretação ou alerta.');
      await loadHistory();
    } catch {
      setSubmit('error');
      setMessage(
        'Não foi possível registrar agora. Tente novamente em instantes.',
      );
    }
  }

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12 md:py-20">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-800">
        Registro manual
      </p>
      <h1 className="mt-4 text-4xl font-medium tracking-tight md:text-5xl">
        Registrar glicose
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
        Registre uma medição capilar em mg/dL para organizar seu histórico. Esta
        tela não avalia o resultado nem mostra faixas ou alertas.
      </p>
      <div
        role="status"
        aria-live="polite"
        className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 text-stone-700"
      >
        {access === 'loading'
          ? 'Verificando seu acesso…'
          : access === 'unauthenticated'
            ? 'Entre na sua conta e autorize a finalidade de autocuidado para registrar uma medição.'
            : access === 'error'
              ? 'Não foi possível verificar seu acesso. Tente novamente em instantes.'
              : message ||
                'A medição será vinculada somente à sua conta e ao seu consentimento vigente.'}
      </div>
      {access === 'authenticated' ? (
        <div className="mt-8 space-y-8">
          <form
            onSubmit={(event) => void record(event)}
            className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm"
          >
            <label
              htmlFor="glucose-value"
              className="block text-sm font-medium"
            >
              Medição em mg/dL
            </label>
            <input
              id="glucose-value"
              name="glucose-value"
              inputMode="decimal"
              autoComplete="off"
              value={decimalValue}
              onChange={(event) => setDecimalValue(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base"
              aria-describedby="glucose-value-help"
              required
            />
            <p id="glucose-value-help" className="mt-2 text-sm text-stone-600">
              Use apenas o valor exibido pelo seu medidor. Não há conversão de
              unidade.
            </p>
            <label
              htmlFor="glucose-occurred-at"
              className="mt-6 block text-sm font-medium"
            >
              Momento da medição
            </label>
            <input
              id="glucose-occurred-at"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5"
              required
            />
            <p className="mt-2 text-sm text-stone-600">
              A origem será registrada como medição capilar manual declarada por
              você.
            </p>
            <Button className="mt-6" disabled={submit === 'loading'}>
              {submit === 'loading' ? 'Registrando…' : 'Registrar medição'}
            </Button>
          </form>
          <section className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold">Medições registradas</h2>
            {historyState === 'loading' && history.length === 0 ? (
              <p className="mt-4 text-sm text-stone-600">
                Carregando medições…
              </p>
            ) : historyState === 'error' ? (
              <p className="mt-4 text-sm text-stone-600">
                Não foi possível carregar suas medições agora.
              </p>
            ) : history.length === 0 ? (
              <p className="mt-4 text-sm text-stone-600">
                Nenhuma medição registrada ainda.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {history.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <p className="font-semibold">{item.decimal_value} mg/dL</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.occurred_at))}
                    </p>
                    <Button
                      type="button"
                      className="mt-3"
                      onClick={() => {
                        setCorrection(item);
                        setDecimalValue(item.decimal_value);
                        setOccurredAt(item.occurred_at.slice(0, 16));
                      }}
                    >
                      Corrigir medição
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {correction ? (
            <form
              onSubmit={(event) => void correct(event)}
              className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm"
            >
              <h2 className="text-xl font-semibold">Corrigir medição</h2>
              <p className="mt-2 text-sm text-stone-600">
                A correção cria uma nova versão e preserva o registro anterior.
              </p>
              <label
                className="mt-5 block text-sm font-medium"
                htmlFor="correction-value"
              >
                Medição em mg/dL
              </label>
              <input
                id="correction-value"
                inputMode="decimal"
                value={decimalValue}
                onChange={(event) => setDecimalValue(event.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5"
                required
              />
              <label
                className="mt-5 block text-sm font-medium"
                htmlFor="correction-occurred"
              >
                Momento da medição
              </label>
              <input
                id="correction-occurred"
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5"
                required
              />
              <div className="mt-6 flex gap-3">
                <Button disabled={submit === 'loading'}>
                  {submit === 'loading' ? 'Corrigindo…' : 'Salvar correção'}
                </Button>
                <Button type="button" onClick={() => setCorrection(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
