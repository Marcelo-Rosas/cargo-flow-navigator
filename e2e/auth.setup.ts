import { expect } from '@playwright/test';
import { test as setup } from '@playwright/test';

const authFile = '.auth/user.json';

setup('authenticate', async ({ page }) => {
  const user = process.env.PW_TEST_USER;
  const password = process.env.PW_TEST_PASSWORD;

  if (!user || !password) {
    throw new Error(
      'Defina PW_TEST_USER e PW_TEST_PASSWORD no .env para rodar testes que exigem autenticação. Ex.: .env.example'
    );
  }

  await page.goto('/auth');
  await page.getByLabel(/e-mail/i).fill(user);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();

  await expect(page).not.toHaveURL(/\/auth/);
  await page.context().storageState({ path: authFile });
});
