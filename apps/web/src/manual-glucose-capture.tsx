import { useEffect, useState, type FormEvent } from 'react';
import { Value } from '@sinclair/typebox/value';
import { ManualGlucoseObservationSchema, MeSchema } from '@glucora/contracts';
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
        <form
          onSubmit={(event) => void record(event)}
          className="mt-8 rounded-3xl border border-stone-200 bg-white p-7 shadow-sm"
        >
          <label htmlFor="glucose-value" className="block text-sm font-medium">
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
      ) : null}
    </main>
  );
}
