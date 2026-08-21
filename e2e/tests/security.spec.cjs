const { test, expect } = require("@playwright/test");

test.describe("segurança pública", () => {
  test("respostas públicas enviam a baseline de cabeçalhos", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();

    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-permitted-cross-domain-policies"]).toBe("none");
    expect(headers["permissions-policy"]).toContain("geolocation=()");

    const csp = headers["content-security-policy"] || "";
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  test("primeiro contato não expõe campos detalhados do aluno", async ({ page }) => {
    await page.goto("/#quero-conhecer");

    for (const name of ["child_name", "child_age", "subjects", "main_difficulties", "message"]) {
      await expect(page.locator(`[name="${name}"]`)).toHaveCount(0);
    }
  });
});
