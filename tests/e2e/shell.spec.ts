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
