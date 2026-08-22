const { test, expect } = require("@playwright/test");

test.describe("descoberta pública", () => {
  test("landing publica metadados sociais e imagem compartilhável", async ({ page, request }) => {
    await page.goto("/");

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute("content");
    expect(ogImage || "").toContain("/brand/plumareli-logo-oficial.webp");
    expect(twitterImage || "").toContain("/brand/plumareli-logo-oficial.webp");

    const imageResponse = await request.get("/brand/plumareli-logo-oficial.webp");
    expect(imageResponse.ok()).toBeTruthy();
    expect(imageResponse.headers()["content-type"] || "").toContain("image/webp");
  });

  test("robots protege áreas autenticadas e sitemap não anuncia termos não publicados", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    const robotsText = await robots.text();
    expect(robotsText).toContain("Disallow: /admin/");
    expect(robotsText).toContain("Disallow: /familia/");
    expect(robotsText).toContain("Disallow: /aluno/");
    expect(robotsText).toContain("Sitemap:");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain("politica-de-privacidade");
    expect(sitemapText).toContain("privacidade-da-crianca");
    expect(sitemapText).not.toContain("termos-de-uso");
  });

  test("analytics público aceita somente eventos sem PII", async ({ request }) => {
    const accepted = await request.post("/api/public-events", {
      data: { name: "lead_cta_click", path: "/", placement: "inicio" },
    });
    expect(accepted.status()).toBe(204);
    expect(accepted.headers()["cache-control"] || "").toContain("no-store");

    const rejected = await request.post("/api/public-events", {
      data: { name: "lead_success", path: "/", email: "teste@example.com" },
    });
    expect(rejected.status()).toBe(400);
  });
});
