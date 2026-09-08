import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@glucora/ui';
import { Value } from '@sinclair/typebox/value';
import { HealthSchema } from '@glucora/contracts';
import './styles.css';
function App() {
  const [view, setView] = useState<'home' | 'privacy'>('home');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  async function checkConnection() {
    setStatus('loading');
    try {
      const response = await fetch('/v1/ready', {
        signal: AbortSignal.timeout(4000),
        cache: 'no-store',
      });
      const body: unknown = await response.json();
      setStatus(
        response.ok && Value.Check(HealthSchema, body) ? 'ready' : 'error',
      );
    } catch {
      setStatus('error');
    }
  }
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <a
          href="/"
          aria-label="Glucora, início"
          className="flex items-center gap-3 text-2xl font-semibold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-800 text-white"
          >
            g
          </span>
          glucora
        </a>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setView(view === 'privacy' ? 'home' : 'privacy')}
            className="rounded-full px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            {view === 'privacy' ? 'Início' : 'Privacidade'}
          </button>
          <span className="hidden rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 sm:inline-flex">
            Em desenvolvimento
          </span>
        </div>
      </header>
      {view === 'home' ? (
        <main
          id="main"
          className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.25fr_1fr] md:py-28"
        >
          <section>
            <p className="mb-6 text-xs font-semibold uppercase tracking-[.2em] text-teal-800">
              Cuidado que considera sua história
            </p>
            <h1 className="max-w-xl text-5xl leading-[1.12] font-medium tracking-tight md:text-6xl">
              Mais contexto.
              <br />
              <span className="text-teal-800">Mais compreensão.</span>
            </h1>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-stone-600">
              Estamos construindo um espaço para organizar a sua jornada com
              diabetes e ajudar você a se preparar para as conversas sobre seu
              cuidado.
            </p>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-stone-500">
              Esta versão inicial ainda não recebe informações de saúde.
              Cadastro e registros serão disponibilizados nas próximas etapas.
            </p>
          </section>
          <aside className="self-center rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
            <div
              aria-hidden="true"
              className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-800"
            >
              ◎
            </div>
            <h2 className="text-xl font-semibold">Um começo com cuidado</h2>
            <p className="mt-3 leading-relaxed text-stone-600">
              Privacidade, clareza e respeito à sua história orientam cada etapa
              da Glucora.
            </p>
            <div className="my-7 h-px bg-stone-100" />
            <Button
              type="button"
              onClick={() => void checkConnection()}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Verificando…' : 'Verificar conexão'}
            </Button>
            <p
              role="status"
              aria-live="polite"
              className="mt-4 min-h-10 text-sm text-stone-600"
            >
              {status === 'ready'
                ? 'Conexão disponível.'
                : status === 'error'
                  ? 'Não foi possível conectar. Tente novamente em instantes.'
                  : status === 'loading'
                    ? 'Aguarde um instante.'
                    : 'Você pode verificar a disponibilidade do serviço.'}
            </p>
          </aside>
        </main>
      ) : (
        <main id="main" className="mx-auto max-w-5xl px-6 py-12 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-800">
            Seus dados, suas escolhas
          </p>
          <h1 className="mt-4 text-4xl font-medium tracking-tight md:text-5xl">
            Privacidade e consentimentos
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
            Este será o lugar para entender como seus dados são usados, revisar
            suas escolhas e exercer seus direitos.
          </p>

          <div
            role="status"
            className="mt-10 flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
          >
            <span aria-hidden="true" className="text-xl">
              ◷
            </span>
            <div>
              <p className="font-semibold">Controles em preparação</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900">
                Ainda não há tratamentos ou consentimentos disponíveis nesta
                versão. Nenhuma escolha pode ser registrada por esta tela.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <section className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-800">
                    Consentimentos
                  </p>
                  <h2 className="mt-3 text-xl font-semibold">
                    Nenhum consentimento disponível
                  </h2>
                </div>
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-800"
                >
                  ✓
                </span>
              </div>
              <p className="mt-4 leading-relaxed text-stone-600">
                Quando houver uma finalidade aprovada, você verá o texto e a
                versão antes de decidir. Também poderá consultar o histórico e
                revogar quando aplicável.
              </p>
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-800">
                Seus direitos
              </p>
              <h2 className="mt-3 text-xl font-semibold">Área em preparação</h2>
              <ul className="mt-5 space-y-3 text-sm text-stone-600">
                {[
                  'Acessar e exportar seus dados',
                  'Corrigir informações',
                  'Solicitar exclusão quando aplicável',
                  'Entender compartilhamentos',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center justify-between gap-4"
                  >
                    <span>{item}</span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-500">
                      Em breve
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="mt-8 rounded-2xl border border-stone-200 p-5 text-sm leading-relaxed text-stone-600">
            A Glucora ainda não recebe informações de saúde nesta versão. Esta
            área evoluirá junto com os controles técnicos e as aprovações de
            privacidade necessárias.
          </div>
        </main>
      )}
      <footer className="mx-auto max-w-6xl border-t border-stone-200 px-6 py-7 text-sm text-stone-500">
        Glucora · Contexto para participar do seu cuidado.
      </footer>
    </div>
  );
}
const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
