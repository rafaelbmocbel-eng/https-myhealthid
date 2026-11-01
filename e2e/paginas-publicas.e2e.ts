import { test, expect, type Page } from '@playwright/test';

// O build de teste aponta o Supabase para um endereço que não existe (.invalid): nada sai para a internet e nenhum dado real é
// tocado. Aqui a "resposta do servidor" é simulada.
async function simularServidor(page: Page) {
  await page.route(/\.invalid\//, (rota) => {
    const url = rota.request().url();
    if (url.includes('/auth/v1/token')) {
      return rota.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) });
    }
    if (url.includes('/functions/v1/')) {
      return rota.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Link não encontrado.' }) });
    }
    return rota.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

// Erros de JavaScript e console.error do próprio app. "Failed to load resource" é ruído do navegador para as respostas simuladas.
function vigiarErros(page: Page, permitidos: RegExp[] = []) {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(`erro de JavaScript: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const texto = m.text();
    if (/Failed to load resource/.test(texto) || permitidos.some((p) => p.test(texto))) return;
    erros.push(`console.error: ${texto}`);
  });
  return erros;
}

test.beforeEach(async ({ page }) => {
  await simularServidor(page);
});

test('a página inicial abre sem erro de JavaScript', async ({ page }) => {
  const erros = vigiarErros(page);
  const resposta = await page.goto('/');
  expect(resposta?.status()).toBe(200);
  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(erros).toEqual([]);
});

test('login do profissional: mostra o formulário e trata a recusa do servidor', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  await page.locator('#email').fill('teste@exemplo.com');
  await page.locator('#password').fill('senha-errada-123');
  await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
  await expect(page.getByText('Erro ao entrar').first()).toBeVisible();
  expect(erros).toEqual([]);
});

test('login do portal do cliente abre com o formulário', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.goto('/paciente/login');
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  expect(erros).toEqual([]);
});

test('link de avaliação inválido mostra "Link inválido" em vez de quebrar', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.goto('/avaliacao/token-que-nao-existe');
  await expect(page.getByText(/Link (inválido|não encontrado)/i).first()).toBeVisible();
  expect(erros).toEqual([]);
});

test('rota que não existe mostra a página 404', async ({ page }) => {
  const erros = vigiarErros(page, [/404 Error: User attempted to access non-existent route/]);
  await page.goto('/essa-rota-nao-existe');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  expect(erros).toEqual([]);
});

for (const caminho of ['/', '/auth', '/paciente/login']) {
  test(`sem rolagem horizontal em ${caminho}`, async ({ page }) => {
    await page.goto(caminho);
    await expect(page.locator('#root')).not.toBeEmpty();
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra).toBeLessThanOrEqual(1);
  });
}
