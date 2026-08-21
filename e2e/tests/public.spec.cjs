const { test, expect } = require("@playwright/test");

test.describe("site público — modelo atual", () => {
  test("landing atual apresenta Irara, proposta de valor e leva ao formulário", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /organize o que estudar/i }),
    ).toBeVisible();
    await expect(page.getByAltText("Irara do Plumareli")).toBeVisible();
    await expect(page.getByText(/contato inicial com poucos dados/i)).toBeVisible();

    const heroCta = page.locator('.hero-buttons a[href="#quero-conhecer"]').first();
    await expect(heroCta).toBeVisible();
    await heroCta.click();

    await expect(page.locator("#quero-conhecer")).toBeVisible();
    await expect(page.locator('.lead-form input[name="guardian_name"]')).toBeVisible();
    await expect(page.locator('.lead-form input[name="phone_whatsapp"]')).toBeVisible();
    await expect(page.locator('.lead-form input[name="email"]')).toBeVisible();
    await expect(page.locator('.lead-form select[name="grade_name"]')).toBeVisible();
  });

  test("primeiro contato coleta somente os dados mínimos definidos na landing nova", async ({ page }) => {
    await page.goto("/#quero-conhecer");

    const form = page.locator(".lead-form");
    const guardian = form.locator('input[name="guardian_name"]');
    const phone = form.locator('input[name="phone_whatsapp"]');
    const email = form.locator('input[name="email"]');
    const grade = form.locator('select[name="grade_name"]');
    const consent = form.locator('input[name="consent_contact"]');

    await expect(guardian).toHaveAttribute("required", "");
    await expect(phone).toHaveAttribute("required", "");
    await expect(email).toHaveAttribute("required", "");
    await expect(grade).toHaveAttribute("required", "");
    await expect(consent).toHaveAttribute("required", "");
    await expect(form.getByRole("link", { name: /política de privacidade/i })).toHaveAttribute(
      "href",
      "/legal/politica-de-privacidade",
    );

    await expect(form.locator('input[name="student_name"]')).toHaveCount(0);
    await expect(form.locator('textarea[name="difficulties"]')).toHaveCount(0);
    await expect(form.locator('input[type="file"]')).toHaveCount(0);

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
