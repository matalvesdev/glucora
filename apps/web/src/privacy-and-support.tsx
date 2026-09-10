import { useEffect, useState, type FormEvent } from 'react';
import { Value } from '@sinclair/typebox/value';
import {
  MeSchema,
  PrivacyRequestSchema,
  SupportRequestSchema,
} from '@glucora/contracts';
import { Button } from '@glucora/ui';

type AccessState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
type SubmitState = 'idle' | 'loading' | 'success' | 'unavailable' | 'error';

async function submitJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
}

function submitMessage(state: SubmitState, success: string) {
  if (state === 'success') return success;
  if (state === 'unavailable')
    return 'Este fluxo ainda aguarda configuração operacional.';
  if (state === 'error')
    return 'Não foi possível concluir. Tente novamente em instantes.';
  if (state === 'loading') return 'Enviando…';
  return '';
}

export function PrivacyAndSupport() {
  const [access, setAccess] = useState<AccessState>('loading');
  const [privacyKind, setPrivacyKind] = useState<
    'access' | 'export' | 'deletion'
  >('access');
  const [supportCategory, setSupportCategory] = useState<
    | 'account_access'
    | 'privacy_rights'
    | 'data_quality'
    | 'sharing'
    | 'unsafe_output'
    | 'technical_issue'
  >('technical_issue');
  const [privacySubmit, setPrivacySubmit] = useState<SubmitState>('idle');
  const [supportSubmit, setSupportSubmit] = useState<SubmitState>('idle');

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

  async function requestPrivacy(event: FormEvent) {
    event.preventDefault();
    setPrivacySubmit('loading');
    try {
      const response = await submitJson('/v1/privacy-requests', {
        kind: privacyKind,
      });
      const body: unknown = await response.json();
      setPrivacySubmit(
        response.status === 503
          ? 'unavailable'
          : response.ok && Value.Check(PrivacyRequestSchema, body)
            ? 'success'
            : 'error',
      );
    } catch {
      setPrivacySubmit('error');
    }
  }

  async function requestSupport(event: FormEvent) {
    event.preventDefault();
    setSupportSubmit('loading');
    try {
      const response = await submitJson('/v1/support-requests', {
        category: supportCategory,
      });
      const body: unknown = await response.json();
      setSupportSubmit(
        response.status === 503
          ? 'unavailable'
          : response.ok && Value.Check(SupportRequestSchema, body)
            ? 'success'
            : 'error',
      );
    } catch {
      setSupportSubmit('error');
    }
  }

  return (
    <main id="main" className="mx-auto max-w-5xl px-6 py-12 md:py-20">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-800">
        Seus dados, suas escolhas
      </p>
      <h1 className="mt-4 text-4xl font-medium tracking-tight md:text-5xl">
        Privacidade e suporte
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
        Consulte suas escolhas, exerça seus direitos e peça ajuda por um canal
        com dados mínimos.
      </p>

      <div
        role="status"
        aria-live="polite"
        className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 text-stone-700"
      >
        {access === 'loading'
          ? 'Verificando seu acesso…'
          : access === 'authenticated'
            ? 'Acesso verificado. Os pedidos abaixo serão vinculados somente à sua conta.'
            : access === 'unauthenticated'
              ? 'Entre na sua conta para enviar ou acompanhar solicitações.'
              : 'Não foi possível verificar seu acesso. Tente novamente em instantes.'}
      </div>

      {access === 'authenticated' ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <form
            onSubmit={(event) => void requestPrivacy(event)}
            className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-800">
              Seus direitos
            </p>
            <h2 className="mt-3 text-xl font-semibold">
              Fazer uma solicitação
            </h2>
            <label
              className="mt-5 block text-sm font-medium"
              htmlFor="privacy-kind"
            >
              Tipo de solicitação
            </label>
            <select
              id="privacy-kind"
              value={privacyKind}
              onChange={(event) =>
                setPrivacyKind(event.target.value as typeof privacyKind)
              }
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5"
            >
              <option value="access">Acessar meus dados</option>
              <option value="export">Exportar meus dados</option>
              <option value="deletion">Solicitar exclusão</option>
            </select>
            <Button className="mt-5" disabled={privacySubmit === 'loading'}>
              Enviar solicitação
            </Button>
            <p
              aria-live="polite"
              className="mt-3 min-h-6 text-sm text-stone-600"
            >
              {submitMessage(privacySubmit, 'Solicitação registrada.')}
            </p>
          </form>

          <form
            onSubmit={(event) => void requestSupport(event)}
            className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-800">
              Suporte
            </p>
            <h2 className="mt-3 text-xl font-semibold">Pedir ajuda</h2>
            <label
              className="mt-5 block text-sm font-medium"
              htmlFor="support-category"
            >
              Assunto
            </label>
            <select
              id="support-category"
              value={supportCategory}
              onChange={(event) =>
                setSupportCategory(event.target.value as typeof supportCategory)
              }
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5"
            >
              <option value="technical_issue">Problema técnico</option>
              <option value="account_access">Acesso à conta</option>
              <option value="privacy_rights">Privacidade e direitos</option>
              <option value="data_quality">Qualidade dos dados</option>
              <option value="sharing">Compartilhamento</option>
              <option value="unsafe_output">Conteúdo inadequado</option>
            </select>
            <Button className="mt-5" disabled={supportSubmit === 'loading'}>
              Enviar pedido
            </Button>
            <p
              aria-live="polite"
              className="mt-3 min-h-6 text-sm text-stone-600"
            >
              {submitMessage(supportSubmit, 'Pedido de suporte registrado.')}
            </p>
          </form>
        </div>
      ) : null}

      <section className="mt-8 rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-800">
          Consentimentos
        </p>
        <h2 className="mt-3 text-xl font-semibold">
          Nenhum consentimento disponível
        </h2>
        <p className="mt-4 leading-relaxed text-stone-600">
          Quando houver uma finalidade aprovada, você verá o texto e a versão
          antes de decidir. Também poderá consultar o histórico e revogar quando
          aplicável.
        </p>
      </section>
    </main>
  );
}
