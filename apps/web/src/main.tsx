import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@glucora/ui';
import { Value } from '@sinclair/typebox/value';
import { HealthSchema } from '@glucora/contracts';
import './styles.css';
function App() {
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
        <span className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600">
          Em desenvolvimento
        </span>
      </header>
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
            Esta versão inicial ainda não recebe informações de saúde. Cadastro
            e registros serão disponibilizados nas próximas etapas.
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
