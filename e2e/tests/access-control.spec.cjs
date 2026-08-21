const { test, expect } = require("@playwright/test");

const protectedRoutes = ["/admin", "/professor", "/familia", "/aluno"];

test.describe("controle de acesso", () => {
  for (const route of protectedRoutes) {
    test(`${route} redireciona visitante para login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
    });
  }
});
