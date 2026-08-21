const { test, expect } = require("@playwright/test");

test.describe("site público", () => {
  test("landing apresenta proposta de valor e leva ao formulário", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /acompanhamento escolar/i }),
    ).toBeVisible();

    const heroCta = page.locator('.hero-buttons a[href="#quero-conhecer"]').first();
    await expect(heroCta).toBeVisible();
    await heroCta.click();

    await expect(page.locator("#quero-conhecer")).toBeVisible();
    await expect(page.locator('form[action] input[name="guardian_name"]')).toBeVisible();
    await expect(page.locator('form[action] input[name="phone_whatsapp"]')).toBeVisible();
    await expect(page.locator('form[action] input[name="email"]')).toBeVisible();
  });

  test("formulário mantém validações nativas obrigatórias", async ({ page }) => {
    await page.goto("/#quero-conhecer");

    const guardian = page.locator('input[name="guardian_name"]');
    const phone = page.locator('input[name="phone_whatsapp"]');
    const email = page.locator('input[name="email"]');
    const grade = page.locator('select[name="grade_name"]');
    const consent = page.locator('input[name="consent_contact"]');

    await expect(guardian).toHaveAttribute("required", "");
    await expect(phone).toHaveAttribute("required", "");
    await expect(email).toHaveAttribute("required", "");
    await expect(grade).toHaveAttribute("required", "");
    await expect(consent).toHaveAttribute("required", "");

    await email.fill("email-invalido");
    expect(await email.evaluate((element) => element.checkValidity())).toBe(false);
  });

  test("login expõe primeiro acesso e recuperação de senha", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { level: 2, name: /entrar no plumareli/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /primeiro acesso/i })).toHaveAttribute(
      "href",
      "/primeiro-acesso",
    );
    await expect(page.getByRole("link", { name: /esqueci minha senha/i })).toHaveAttribute(
      "href",
      "/esqueci-senha",
    );
  });
});
