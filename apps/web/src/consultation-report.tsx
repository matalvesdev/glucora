import { useEffect, useState, type FormEvent } from 'react';
import { Value } from '@sinclair/typebox/value';
import {
  ConsultationReportSchema,
  CreateShareGrantBodySchema,
  MeSchema,
  ShareGrantSchema,
} from '@glucora/contracts';
import { Button } from '@glucora/ui';

type Access = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export function ConsultationReport() {
  const [access, setAccess] = useState<Access>('loading');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<{
    id: string;
    period: { from: string; to: string };
    total_records: number;
    limitations: string[];
  } | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [recipientRef, setRecipientRef] = useState('');
  const [purposeVersionId, setPurposeVersionId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [share, setShare] = useState<{
    id: string;
    version: number;
    status: 'active' | 'revoked';
    expires_at: string;
  } | null>(null);
  useEffect(() => {
    void fetch('/v1/me', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const body: unknown = await response.json();
        setAccess(
          response.ok && Value.Check(MeSchema, body)
            ? 'authenticated'
            : response.status === 401 || response.status === 403
              ? 'unauthenticated'
              : 'error',
        );
      })
      .catch(() => setAccess('error'));
  }, []);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (
      !from ||
      !to ||
      !Number.isFinite(Date.parse(from)) ||
      Date.parse(from) >= Date.parse(to)
    ) {
      setMessage('Informe um período válido.');
      return;
    }
    const period = {
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    };
    try {
      const response = await fetch('/v1/consultation-reports', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify(period),
      });
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(ConsultationReportSchema, body))
        throw new Error('invalid');
      const value = body as {
        id: string;
        period: { from: string; to: string };
        total_records: number;
        limitations: string[];
      };
      setReport(value);
      setMessage('Resumo criado sem interpretação clínica.');
    } catch {
      setMessage('Não foi possível criar o resumo agora.');
    }
  }
  async function toggleQuestion(questionKey: string) {
    if (!report) return;
    const action = questions.includes(questionKey) ? 'removed' : 'added';
    try {
      const response = await fetch(
        `/v1/consultation-reports/${report.id}/questions`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': crypto.randomUUID(),
          },
          body: JSON.stringify({ question_key: questionKey, action }),
        },
      );
      if (!response.ok) throw new Error('invalid');
      setQuestions((current) =>
        action === 'added'
          ? [...current, questionKey]
          : current.filter((item) => item !== questionKey),
      );
    } catch {
      setMessage('Não foi possível atualizar suas perguntas agora.');
    }
  }
  async function createShare() {
    if (
      !report ||
      !Value.Check(CreateShareGrantBodySchema, {
        recipient_ref: recipientRef,
        purpose_version_id: purposeVersionId,
        expires_at: new Date(expiresAt).toISOString(),
      })
    ) {
      setMessage(
        'Informe a referência opaca, a finalidade publicada e uma expiração válida.',
      );
      return;
    }
    try {
      const response = await fetch(
        `/v1/consultation-reports/${report.id}/shares`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            recipient_ref: recipientRef,
            purpose_version_id: purposeVersionId,
            expires_at: new Date(expiresAt).toISOString(),
          }),
        },
      );
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(ShareGrantSchema, body))
        throw new Error('invalid');
      const value = body as {
        id: string;
        version: number;
        status: 'active' | 'revoked';
        expires_at: string;
      };
      setShare(value);
      setMessage(
        'Compartilhamento criado. A entrega ao destinatário ainda não está habilitada.',
      );
    } catch {
      setMessage('Não foi possível criar o compartilhamento agora.');
    }
  }
  async function revokeShare() {
    if (!share) return;
    try {
      const response = await fetch(`/v1/shares/${share.id}/revoke`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({ expected_version: share.version }),
      });
      const body: unknown = await response.json();
      if (!response.ok || !Value.Check(ShareGrantSchema, body))
        throw new Error('invalid');
      setShare(body as typeof share);
      setMessage('Compartilhamento revogado.');
    } catch {
      setMessage('Não foi possível revogar o compartilhamento agora.');
    }
  }
  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12 md:py-20">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-800">
        Preparação para consulta
      </p>
      <h1 className="mt-4 text-4xl font-medium tracking-tight md:text-5xl">
        Organizar seu histórico
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
        Crie um resumo descritivo de registros para um período. Ele não
        interpreta seus dados nem faz recomendações.
      </p>
      <div
        role="status"
        aria-live="polite"
        className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 text-stone-700"
      >
        {access === 'loading'
          ? 'Verificando seu acesso…'
          : access === 'unauthenticated'
            ? 'Entre na sua conta e autorize a finalidade de autocuidado para preparar um resumo.'
            : access === 'error'
              ? 'Não foi possível verificar seu acesso.'
              : message}
      </div>
      {access === 'authenticated' ? (
        <div className="mt-8 space-y-8">
          <form
            onSubmit={(event) => void create(event)}
            className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm"
          >
            <label className="block text-sm font-medium" htmlFor="report-from">
              Início do período
            </label>
            <input
              id="report-from"
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5"
              required
            />
            <label
              className="mt-6 block text-sm font-medium"
              htmlFor="report-to"
            >
              Fim do período
            </label>
            <input
              id="report-to"
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5"
              required
            />
            <Button className="mt-6">Criar resumo</Button>
          </form>
          {report ? (
            <section className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
              <h2 className="text-xl font-semibold">Resumo do período</h2>
              <p className="mt-3 text-stone-600">
                {report.total_records} registros no período selecionado.
              </p>
              <p className="mt-4 text-sm text-stone-600">
                Limitações: este resumo é apenas descritivo; ausência de
                registros não prova ausência de eventos; contagens não medem
                saúde ou controle.
              </p>
              <fieldset className="mt-6">
                <legend className="font-semibold">
                  Perguntas para levar à consulta
                </legend>
                <p className="mt-2 text-sm text-stone-600">
                  Escolha temas para conversar. Estas opções não são
                  recomendações.
                </p>
                {(
                  [
                    ['review_records', 'Revisar meus registros'],
                    ['discuss_routine', 'Conversar sobre minha rotina'],
                    ['clarify_next_steps', 'Esclarecer próximos passos'],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="mt-3 flex items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={questions.includes(key)}
                      onChange={() => void toggleQuestion(key)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <fieldset className="mt-8 border-t border-stone-200 pt-6">
                <legend className="font-semibold">
                  Compartilhar este resumo
                </legend>
                <p className="mt-2 text-sm text-stone-600">
                  Use somente uma referência opaca previamente emitida. Nenhum
                  e-mail ou telefone é aceito.
                </p>
                <input
                  aria-label="Referência opaca do destinatário"
                  value={recipientRef}
                  onChange={(event) => setRecipientRef(event.target.value)}
                  placeholder="Referência opaca"
                  className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
                <input
                  aria-label="ID da versão da finalidade"
                  value={purposeVersionId}
                  onChange={(event) => setPurposeVersionId(event.target.value)}
                  placeholder="ID da finalidade publicada"
                  className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
                <input
                  aria-label="Expiração do compartilhamento"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={() => void createShare()}>
                    Criar compartilhamento
                  </Button>
                  {share?.status === 'active' ? (
                    <Button type="button" onClick={() => void revokeShare()}>
                      Revogar compartilhamento
                    </Button>
                  ) : null}
                </div>
                {share ? (
                  <p className="mt-3 text-sm text-stone-600">
                    Estado: {share.status}; expira em{' '}
                    {new Date(share.expires_at).toLocaleString()}.
                  </p>
                ) : null}
              </fieldset>
            </section>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
