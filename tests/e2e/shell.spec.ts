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
      name: 'Suas escolhas',
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Entre na sua conta para consultar e controlar'),
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
  let privacyListCalls = 0;
  let supportListCalls = 0;
  let consentPurposeCalls = 0;
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
  await page.route('**/v1/consent-purposes', (route) => {
    consentPurposeCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'pur_syntheticpurpose001',
            purpose_key: 'self_care_health_data',
            version: 1,
            title: 'Finalidade sintética',
            notice_text: 'Texto sintético da finalidade aprovada.',
            legal_basis_ref: 'LGPD art. 11, I',
            retention_policy_ref: 'Política sintética',
            current_decision: consentPurposeCalls === 1 ? 'granted' : 'revoked',
          },
        ],
        request_id: '123e4567-e89b-42d3-a456-426614174000',
      }),
    });
  });
  await page.route('**/v1/consent-decisions', async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'cne_syntheticdecision001',
        purpose_version_id: 'pur_syntheticpurpose001',
        decision: 'revoked',
        occurred_at: '2026-01-04T00:00:00.000Z',
        recorded_at: '2026-01-04T00:00:01.000Z',
        request_id: '123e4567-e89b-42d3-a456-426614174000',
      }),
    });
  });
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
  await page.route('**/v1/privacy-requests?*', async (route) => {
    privacyListCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'dsr_syntheticrequest0001',
            kind: 'export',
            scope: 'all_user_data',
            status: 'in_review',
            version: 2,
            requested_at: '2026-01-02T00:00:00.000Z',
            updated_at: '2026-01-03T00:00:00.000Z',
          },
          ...(privacyListCalls > 1
            ? [
                {
                  id: 'dsr_syntheticrequest0002',
                  kind: 'export',
                  scope: 'all_user_data',
                  status: 'requested',
                  version: 1,
                  requested_at: '2026-01-04T00:00:00.000Z',
                  updated_at: '2026-01-04T00:00:00.000Z',
                },
              ]
            : []),
        ],
        next_cursor: null,
        request_id: '123e4567-e89b-42d3-a456-426614174000',
      }),
    });
  });
  await page.route(
    '**/v1/privacy-requests/dsr_syntheticrequest0001/history',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              from_status: null,
              to_status: 'requested',
              occurred_at: '2026-01-02T00:00:00.000Z',
            },
            {
              from_status: 'requested',
              to_status: 'in_review',
              occurred_at: '2026-01-03T00:00:00.000Z',
            },
          ],
          request_id: '123e4567-e89b-42d3-a456-426614174000',
        }),
      }),
  );
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
  await page.route('**/v1/support-requests?*', async (route) => {
    supportListCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items:
          supportListCalls === 2
            ? [
                {
                  id: 'sup_syntheticrequest0001',
                  category: 'technical_issue',
                  status: 'submitted',
                  created_at: '2026-01-02T00:00:00.000Z',
                },
              ]
            : supportListCalls === 3
              ? [
                  {
                    id: 'sup_syntheticrequest0002',
                    category: 'sharing',
                    status: 'submitted',
                    created_at: '2026-01-01T00:00:00.000Z',
                  },
                ]
              : [],
        next_cursor: supportListCalls === 2 ? 'c3VwcG9ydC1jdXJzb3I' : null,
        request_id: '123e4567-e89b-42d3-a456-426614174000',
      }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Privacidade e suporte' }).click();
  await expect(page.getByRole('status')).toContainText('Acesso verificado');
  await expect(page.getByText('Finalidade sintética').first()).toBeVisible();
  await expect(page.getByText('Autorizado').first()).toBeVisible();
  await page.getByRole('button', { name: 'Revogar consentimento' }).click();
  await expect(page.getByRole('button', { name: 'Autorizar' })).toBeVisible();
  await expect(page.getByText('Exportação de dados')).toBeVisible();
  await expect(page.getByText('Em análise')).toBeVisible();
  await page.getByRole('button', { name: 'Ver histórico' }).click();
  await expect(page.getByText('Pedido recebido')).toBeVisible();
  await page.getByLabel('Tipo de solicitação').selectOption('export');
  await page.getByRole('button', { name: 'Enviar solicitação' }).click();
  await expect(page.getByText('Solicitação registrada.')).toBeVisible();
  await expect(page.getByText('Recebido', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByText('Pedido de suporte registrado.')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Pedidos enviados' }),
  ).toBeVisible();
  const supportSection = page.locator('section').filter({
    has: page.getByRole('heading', { level: 2, name: 'Pedidos enviados' }),
  });
  await supportSection.getByRole('button', { name: 'Ver mais' }).click();
  await expect(supportSection.getByText('Compartilhamento')).toBeVisible();
  await expect(
    page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { level: 2, name: 'Pedidos enviados' }),
      })
      .getByText('Problema técnico', { exact: true }),
  ).toBeVisible();
  expect(payloads).toEqual([
    {
      purpose_version_id: 'pur_syntheticpurpose001',
      decision: 'revoked',
    },
    { kind: 'export' },
    { category: 'technical_issue' },
  ]);
  await expect(page.locator('textarea,input')).toHaveCount(0);
});
