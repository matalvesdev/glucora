import { useEffect, useState, type FormEvent } from 'react';
import { Value } from '@sinclair/typebox/value';
import {
  ConsentDecisionResponseSchema,
  ConsentHistoryResponseSchema,
  ConsentPurposeListSchema,
  MeSchema,
  PrivacyRequestSchema,
  PrivacyRequestListSchema,
  PrivacyRequestHistorySchema,
  SupportRequestSchema,
  SupportRequestListSchema,
} from '@glucora/contracts';
import { Button } from '@glucora/ui';

type AccessState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
type SubmitState = 'idle' | 'loading' | 'success' | 'unavailable' | 'error';
interface ConsentHistoryViewItem {
  event_id: string;
  purpose_version_id: string;
  purpose_key: string;
  purpose_version: number;
  purpose_title: string;
  notice_text: string;
  decision: 'granted' | 'denied' | 'revoked';
  occurred_at: string;
  recorded_at: string;
}
interface ConsentPurposeViewItem {
  id: string;
  purpose_key: string;
  version: number;
  title: string;
  notice_text: string;
  legal_basis_ref: string;
  retention_policy_ref: string;
  current_decision: 'granted' | 'denied' | 'revoked' | null;
}
interface PrivacyRequestViewItem {
  id: string;
  kind: 'access' | 'export' | 'deletion';
  status:
    | 'requested'
    | 'identity_verification_required'
    | 'in_review'
    | 'fulfilled'
    | 'partially_fulfilled'
    | 'denied'
    | 'cancelled';
  requested_at: string;
}
interface PrivacyRequestHistoryViewItem {
  from_status: PrivacyRequestViewItem['status'] | null;
  to_status: PrivacyRequestViewItem['status'];
  occurred_at: string;
}
interface SupportRequestViewItem {
  id: string;
  category:
    | 'account_access'
    | 'privacy_rights'
    | 'data_quality'
    | 'sharing'
    | 'unsafe_output'
    | 'technical_issue';
  status: 'submitted';
  created_at: string;
}

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
  const [supportRequests, setSupportRequests] = useState<
    readonly SupportRequestViewItem[]
  >([]);
  const [supportListState, setSupportListState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [supportCursor, setSupportCursor] = useState<string | null>(null);
  const [consentHistory, setConsentHistory] = useState<
    readonly ConsentHistoryViewItem[]
  >([]);
  const [consentCursor, setConsentCursor] = useState<string | null>(null);
  const [consentState, setConsentState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [consentPurposes, setConsentPurposes] = useState<
    readonly ConsentPurposeViewItem[]
  >([]);
  const [consentPurposeState, setConsentPurposeState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [consentDecisionState, setConsentDecisionState] = useState<
    Record<string, SubmitState>
  >({});
  const [privacyRequests, setPrivacyRequests] = useState<
    readonly PrivacyRequestViewItem[]
  >([]);
  const [privacyCursor, setPrivacyCursor] = useState<string | null>(null);
  const [privacyListState, setPrivacyListState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [privacyHistory, setPrivacyHistory] = useState<
    Readonly<Record<string, readonly PrivacyRequestHistoryViewItem[]>>
  >({});
  const [privacyHistoryLoading, setPrivacyHistoryLoading] = useState<
    string | null
  >(null);
  const [exportDownloadState, setExportDownloadState] = useState<
    Readonly<Record<string, 'loading' | 'error'>>
  >({});

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

  async function loadConsentHistory(cursor?: string) {
    setConsentState('loading');
    try {
      const query = new URLSearchParams({ limit: '20' });
      if (cursor) query.set('cursor', cursor);
      const response = await fetch(`/v1/consents/history?${query}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(ConsentHistoryResponseSchema, body)) {
        setConsentState('error');
        return;
      }
      const value = body as {
        items: ConsentHistoryViewItem[];
        next_cursor: string | null;
      };
      setConsentHistory((current) =>
        cursor ? [...current, ...value.items] : value.items,
      );
      setConsentCursor(value.next_cursor);
      setConsentState('ready');
    } catch {
      setConsentState('error');
    }
  }

  async function loadConsentPurposes() {
    setConsentPurposeState('loading');
    try {
      const response = await fetch('/v1/consent-purposes', {
        credentials: 'include',
        cache: 'no-store',
      });
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(ConsentPurposeListSchema, body)) {
        setConsentPurposeState('error');
        return;
      }
      setConsentPurposes((body as { items: ConsentPurposeViewItem[] }).items);
      setConsentPurposeState('ready');
    } catch {
      setConsentPurposeState('error');
    }
  }

  async function recordConsentDecision(
    purposeVersionId: string,
    decision: 'granted' | 'revoked',
  ) {
    setConsentDecisionState((current) => ({
      ...current,
      [purposeVersionId]: 'loading',
    }));
    try {
      const response = await submitJson('/v1/consent-decisions', {
        purpose_version_id: purposeVersionId,
        decision,
      });
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(ConsentDecisionResponseSchema, body)) {
        setConsentDecisionState((current) => ({
          ...current,
          [purposeVersionId]: 'error',
        }));
        return;
      }
      setConsentDecisionState((current) => ({
        ...current,
        [purposeVersionId]: 'success',
      }));
      await Promise.all([loadConsentPurposes(), loadConsentHistory()]);
    } catch {
      setConsentDecisionState((current) => ({
        ...current,
        [purposeVersionId]: 'error',
      }));
    }
  }

  async function loadPrivacyRequests(cursor?: string) {
    setPrivacyListState('loading');
    try {
      const query = new URLSearchParams({ limit: '20' });
      if (cursor) query.set('cursor', cursor);
      const response = await fetch(`/v1/privacy-requests?${query}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(PrivacyRequestListSchema, body)) {
        setPrivacyListState('error');
        return;
      }
      const value = body as {
        items: PrivacyRequestViewItem[];
        next_cursor: string | null;
      };
      setPrivacyRequests((current) =>
        cursor ? [...current, ...value.items] : value.items,
      );
      setPrivacyCursor(value.next_cursor);
      setPrivacyListState('ready');
    } catch {
      setPrivacyListState('error');
    }
  }

  async function loadPrivacyHistory(id: string) {
    if (privacyHistory[id]) {
      setPrivacyHistory((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }
    setPrivacyHistoryLoading(id);
    try {
      const response = await fetch(`/v1/privacy-requests/${id}/history`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(PrivacyRequestHistorySchema, body))
        return;
      setPrivacyHistory((current) => ({
        ...current,
        [id]: (body as { items: PrivacyRequestHistoryViewItem[] }).items,
      }));
    } finally {
      setPrivacyHistoryLoading(null);
    }
  }

  async function downloadExport(id: string) {
    setExportDownloadState((current) => ({ ...current, [id]: 'loading' }));
    try {
      const response = await fetch(`/v1/privacy-requests/${id}/export`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('export unavailable');
      const expected = response.headers.get('x-glucora-content-sha256');
      const deliveryId = response.headers.get('x-glucora-export-delivery-id');
      if (!expected || !/^[a-f0-9]{64}$/.test(expected))
        throw new Error('export integrity unavailable');
      if (!deliveryId || !/^exp_[A-Za-z0-9_-]{16,64}$/.test(deliveryId))
        throw new Error('export receipt unavailable');
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const actual = [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
      if (actual !== expected) throw new Error('export integrity mismatch');
      const acknowledgement = await submitJson(
        `/v1/privacy-requests/${id}/export-acknowledgements`,
        { delivery_id: deliveryId, sha256: actual },
      );
      const acknowledged: unknown = await acknowledgement.json();
      if (
        !acknowledgement.ok ||
        !Value.Check(PrivacyRequestSchema, acknowledged)
      )
        throw new Error('export acknowledgement failed');
      const blob = new Blob([bytes], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `glucora-export-${id}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportDownloadState((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      await loadPrivacyRequests();
    } catch {
      setExportDownloadState((current) => ({ ...current, [id]: 'error' }));
    }
  }

  async function loadSupportRequests(cursor?: string) {
    setSupportListState('loading');
    try {
      const query = new URLSearchParams({ limit: '20' });
      if (cursor) query.set('cursor', cursor);
      const response = await fetch(`/v1/support-requests?${query}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(SupportRequestListSchema, body)) {
        setSupportListState('error');
        return;
      }
      const value = body as {
        items: SupportRequestViewItem[];
        next_cursor: string | null;
      };
      setSupportRequests((current) =>
        cursor ? [...current, ...value.items] : value.items,
      );
      setSupportCursor(value.next_cursor);
      setSupportListState('ready');
    } catch {
      setSupportListState('error');
    }
  }

  useEffect(() => {
    if (access === 'authenticated') {
      void loadConsentHistory();
      void loadConsentPurposes();
      void loadPrivacyRequests();
      void loadSupportRequests();
    }
  }, [access]);

  async function requestPrivacy(event: FormEvent) {
    event.preventDefault();
    setPrivacySubmit('loading');
    try {
      const response = await submitJson('/v1/privacy-requests', {
        kind: privacyKind,
      });
      const body: unknown = await response.json();
      if (response.status === 503) {
        setPrivacySubmit('unavailable');
        return;
      }
      if (!response.ok || !Value.Check(PrivacyRequestSchema, body)) {
        setPrivacySubmit('error');
        return;
      }
      setPrivacySubmit('success');
      await loadPrivacyRequests();
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
      if (response.status === 503) {
        setSupportSubmit('unavailable');
        return;
      }
      if (!response.ok || !Value.Check(SupportRequestSchema, body)) {
        setSupportSubmit('error');
        return;
      }
      setSupportSubmit('success');
      await loadSupportRequests();
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

      {access === 'authenticated' ? (
        <section className="mt-8 rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-800">
            Acompanhar pedidos
          </p>
          <h2 className="mt-3 text-xl font-semibold">
            Solicitações de privacidade
          </h2>
          {privacyListState === 'error' ? (
            <p className="mt-4 text-sm text-stone-600">
              Não foi possível carregar suas solicitações agora.
            </p>
          ) : privacyListState === 'loading' && privacyRequests.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">
              Carregando solicitações…
            </p>
          ) : privacyRequests.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">
              Nenhuma solicitação registrada.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              <ul className="space-y-3">
                {privacyRequests.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 p-4"
                  >
                    <div>
                      <p className="font-semibold">
                        {item.kind === 'access'
                          ? 'Acesso aos dados'
                          : item.kind === 'export'
                            ? 'Exportação de dados'
                            : 'Solicitação de exclusão'}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'medium',
                        }).format(new Date(item.requested_at))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                        {item.status === 'requested'
                          ? 'Recebido'
                          : item.status === 'identity_verification_required'
                            ? 'Verificação necessária'
                            : item.status === 'in_review'
                              ? 'Em análise'
                              : item.status === 'fulfilled'
                                ? 'Concluído'
                                : item.status === 'partially_fulfilled'
                                  ? 'Concluído parcialmente'
                                  : item.status === 'denied'
                                    ? 'Indeferido'
                                    : 'Cancelado'}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={privacyHistoryLoading === item.id}
                        onClick={() => void loadPrivacyHistory(item.id)}
                      >
                        {privacyHistoryLoading === item.id
                          ? 'Carregando…'
                          : privacyHistory[item.id]
                            ? 'Ocultar histórico'
                            : 'Ver histórico'}
                      </Button>
                      {item.kind === 'export' &&
                      [
                        'requested',
                        'identity_verification_required',
                        'in_review',
                      ].includes(item.status) ? (
                        <Button
                          type="button"
                          disabled={exportDownloadState[item.id] === 'loading'}
                          onClick={() => void downloadExport(item.id)}
                        >
                          {exportDownloadState[item.id] === 'loading'
                            ? 'Preparando…'
                            : 'Baixar JSON'}
                        </Button>
                      ) : null}
                    </div>
                    {exportDownloadState[item.id] === 'error' ? (
                      <p className="w-full text-sm text-stone-600">
                        Entre novamente e tente baixar a exportação.
                      </p>
                    ) : null}
                    {privacyHistory[item.id] ? (
                      <ol className="w-full space-y-2 border-t border-stone-100 pt-3 text-sm text-stone-600">
                        {(privacyHistory[item.id] ?? []).map((event, index) => (
                          <li key={`${event.occurred_at}-${index}`}>
                            {event.to_status === 'requested'
                              ? 'Pedido recebido'
                              : event.to_status ===
                                  'identity_verification_required'
                                ? 'Verificação necessária'
                                : event.to_status === 'in_review'
                                  ? 'Em análise'
                                  : event.to_status === 'fulfilled'
                                    ? 'Concluído'
                                    : event.to_status === 'partially_fulfilled'
                                      ? 'Concluído parcialmente'
                                      : event.to_status === 'denied'
                                        ? 'Indeferido'
                                        : 'Cancelado'}{' '}
                            ·{' '}
                            {new Intl.DateTimeFormat('pt-BR', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(event.occurred_at))}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </li>
                ))}
              </ul>
              {privacyCursor ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={privacyListState === 'loading'}
                  onClick={() => void loadPrivacyRequests(privacyCursor)}
                >
                  {privacyListState === 'loading' ? 'Carregando…' : 'Ver mais'}
                </Button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {access === 'authenticated' ? (
        <section className="mt-8 rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-800">
            Seus pedidos de suporte
          </p>
          <h2 className="mt-3 text-xl font-semibold">Pedidos enviados</h2>
          {supportListState === 'error' ? (
            <p className="mt-4 text-sm text-stone-600">
              Não foi possível carregar seus pedidos agora.
            </p>
          ) : supportListState === 'loading' && supportRequests.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">Carregando pedidos…</p>
          ) : supportRequests.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">
              Nenhum pedido de suporte registrado.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              <ul className="space-y-3">
                {supportRequests.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 p-4"
                  >
                    <div>
                      <p className="font-semibold">
                        {item.category === 'technical_issue'
                          ? 'Problema técnico'
                          : item.category === 'account_access'
                            ? 'Acesso à conta'
                            : item.category === 'privacy_rights'
                              ? 'Privacidade e direitos'
                              : item.category === 'data_quality'
                                ? 'Qualidade dos dados'
                                : item.category === 'sharing'
                                  ? 'Compartilhamento'
                                  : 'Conteúdo inadequado'}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'medium',
                        }).format(new Date(item.created_at))}
                      </p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                      Recebido
                    </span>
                  </li>
                ))}
              </ul>
              {supportCursor ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={supportListState === 'loading'}
                  onClick={() => void loadSupportRequests(supportCursor)}
                >
                  {supportListState === 'loading' ? 'Carregando…' : 'Ver mais'}
                </Button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <section className="mt-8 rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-800">
          Consentimentos
        </p>
        <h2 className="mt-3 text-xl font-semibold">Suas escolhas</h2>
        {access !== 'authenticated' ? (
          <p className="mt-4 leading-relaxed text-stone-600">
            Entre na sua conta para consultar e controlar seus consentimentos.
          </p>
        ) : consentPurposeState === 'error' ? (
          <p className="mt-4 text-sm text-stone-600">
            Não foi possível carregar as finalidades agora.
          </p>
        ) : consentPurposeState === 'loading' ? (
          <p className="mt-4 text-sm text-stone-600">Carregando finalidades…</p>
        ) : consentPurposes.length === 0 ? (
          <p className="mt-4 text-sm text-stone-600">
            Não há finalidades disponíveis neste momento.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <ul className="space-y-3">
              {consentPurposes.map((purpose) => {
                const active = purpose.current_decision === 'granted';
                const decisionState =
                  consentDecisionState[purpose.id] ?? 'idle';
                return (
                  <li
                    key={purpose.id}
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">{purpose.title}</p>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                        {active ? 'Autorizado' : 'Não autorizado'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">
                      {purpose.notice_text}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      {purpose.legal_basis_ref} · {purpose.retention_policy_ref}
                    </p>
                    <Button
                      type="button"
                      variant={active ? 'outline' : 'default'}
                      className="mt-4"
                      disabled={decisionState === 'loading'}
                      onClick={() =>
                        void recordConsentDecision(
                          purpose.id,
                          active ? 'revoked' : 'granted',
                        )
                      }
                    >
                      {decisionState === 'loading'
                        ? 'Salvando…'
                        : active
                          ? 'Revogar consentimento'
                          : 'Autorizar'}
                    </Button>
                    {decisionState === 'error' ? (
                      <p className="mt-2 text-sm text-stone-600">
                        Não foi possível salvar sua escolha.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <h3 className="pt-3 text-lg font-semibold">
              Histórico de decisões
            </h3>
            {consentState === 'error' ? (
              <p className="text-sm text-stone-600">
                Não foi possível carregar o histórico agora.
              </p>
            ) : consentState === 'loading' && consentHistory.length === 0 ? (
              <p className="text-sm text-stone-600">Carregando histórico…</p>
            ) : consentHistory.length === 0 ? (
              <p className="text-sm text-stone-600">
                Nenhuma decisão de consentimento registrada.
              </p>
            ) : (
              <ul className="space-y-3">
                {consentHistory.map((item) => (
                  <li
                    key={item.event_id}
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{item.purpose_title}</p>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                        {item.decision === 'granted'
                          ? 'Autorizado'
                          : item.decision === 'revoked'
                            ? 'Revogado'
                            : 'Não autorizado'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">
                      {item.notice_text}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      Versão {item.purpose_version} ·{' '}
                      {new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.occurred_at))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {consentCursor ? (
              <Button
                type="button"
                variant="outline"
                disabled={consentState === 'loading'}
                onClick={() => void loadConsentHistory(consentCursor)}
              >
                {consentState === 'loading' ? 'Carregando…' : 'Ver mais'}
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
