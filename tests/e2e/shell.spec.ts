import { test, expect } from '@playwright/test';
test('responsive shell reports actual backend readiness', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Mais contexto',
  );
  await page.getByRole('button', { name: 'Verificar conexão' }).click();
  await expect(page.getByRole('status')).toHaveText('Conexão disponível.');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('connection failure offers a retry without health data entry', async ({
  page,
}) => {
  await page.route('**/v1/ready', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Verificar conexão' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Não foi possível conectar',
  );
  await expect(
    page.getByRole('button', { name: 'Verificar conexão' }),
  ).toBeEnabled();
  await expect(page.locator('input,textarea')).toHaveCount(0);
});

test('privacy and support remain closed without an authenticated account', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Privacidade' }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Privacidade e suporte',
    }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Entre na sua conta');
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Histórico de decisões',
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Entre na sua conta para consultar'),
  ).toBeVisible();
  await expect(page.locator('input,textarea,[role="switch"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('authenticated user can submit minimized privacy and support requests', async ({
  page,
}) => {
  const payloads: unknown[] = [];
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'usr_syntheticconsumer001',
        kind: 'consumer',
        status: 'active',
        locale: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        request_id: '123e4567-e89b-42d3-a456-426614174000',
      }),
    }),
  );
  await page.route('**/v1/consents/history?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            event_id: 'cne_syntheticevent00001',
            purpose_version_id: 'pur_syntheticpurpose001',
            purpose_key: 'synthetic_context',
            purpose_version: 1,
            purpose_title: 'Finalidade sintética',
            notice_text: 'Texto sintético da finalidade aprovada.',
            decision: 'granted',
            occurred_at: '2026-01-02T00:00:00.000Z',
            recorded_at: '2026-01-02T00:00:01.000Z',
          },
        ],
        next_cursor: null,
        request_id: '123e4567-e89b-42d3-a456-426614174000',
      }),
    }),
  );
  await page.route('**/v1/privacy-requests', async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'dsr_syntheticrequest0001',
        kind: 'export',
        scope: 'all_user_data',
        status: 'requested',
        version: 1,
        requested_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        request_id: '123e4567-e89b-42d3-a456-426614174000',
      }),
    });
  });
  await page.route('**/v1/support-requests', async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'sup_syntheticrequest0001',
        category: 'technical_issue',
        status: 'submitted',
        created_at: '2026-01-02T00:00:00.000Z',
      }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Privacidade e suporte' }).click();
  await expect(page.getByRole('status')).toContainText('Acesso verificado');
  await expect(page.getByText('Finalidade sintética')).toBeVisible();
  await expect(page.getByText('Autorizado')).toBeVisible();
  await page.getByLabel('Tipo de solicitação').selectOption('export');
  await page.getByRole('button', { name: 'Enviar solicitação' }).click();
  await expect(page.getByText('Solicitação registrada.')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByText('Pedido de suporte registrado.')).toBeVisible();
  expect(payloads).toEqual([
    { kind: 'export' },
    { category: 'technical_issue' },
  ]);
  await expect(page.locator('textarea,input')).toHaveCount(0);
});
