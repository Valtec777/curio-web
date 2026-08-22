const { test, expect } = require("@playwright/test");

test.describe("release candidate consolidada", () => {
  test("landing reúne produto, conversão, privacidade, SEO e segurança", async ({ page, request }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response.status()).toBeLessThan(400);

    await expect(page.getByRole("heading", { level: 1, name: /Organize o que estudar agora/i })).toBeVisible();
    await expect(page.getByText("Por dentro do Plumareli", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Prévia ilustrativa do Portal do Aluno")).toBeVisible();
    await expect(page.getByLabel("Prévia ilustrativa do Ninho da Família")).toBeVisible();
    await expect(page.getByLabel("Prévia ilustrativa do acompanhamento de progresso")).toBeVisible();

    const form = page.locator('form:has([name="guardian_name"]):has([name="consent_contact"])').first();
    await expect(form).toBeVisible();
    await expect(form.locator('[name="guardian_name"]')).toHaveCount(1);
    await expect(form.locator('[name="phone_whatsapp"]')).toHaveCount(1);
    await expect(form.locator('[name="email"]')).toHaveCount(1);
    await expect(form.locator('[name="grade_name"]')).toHaveCount(1);
    await expect(form.locator('[name="child_name"], [name="child_age"], [name="subjects"], [name="main_difficulties"]')).toHaveCount(0);

    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"] || "").toContain("frame-ancestors 'none'");

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage || "").toContain("plumareli-logo-oficial.webp");

    const rejected = await request.post("/api/public-events", {
      data: { name: "lead_success", path: "/", email: "nao-deve-entrar@example.com" },
    });
    expect(rejected.status()).toBe(400);
  });
});
