const { test, expect } = require("@playwright/test");

test.describe("responsividade da landing atual", () => {
  test("não cria rolagem horizontal e mantém o CTA principal acessível", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".public-header-inner")).toBeVisible();
    await expect(page.locator('.hero-buttons a[href="#quero-conhecer"]').first()).toBeVisible();

    const horizontalScroll = await page.evaluate(() => {
      const root = document.scrollingElement;
      if (!root) return 0;
      root.scrollLeft = 9999;
      return root.scrollLeft;
    });
    expect(Math.abs(horizontalScroll)).toBeLessThanOrEqual(1);
  });

  test("header segue o contrato de desktop e celular pequeno", async ({ page }) => {
    await page.goto("/");

    const width = page.viewportSize()?.width || 1280;
    const nav = page.locator(".public-nav");
    const primaryHeaderCta = page.locator(".public-actions .button-primary");

    if (width <= 520) {
      await expect(nav).toBeHidden();
      await expect(primaryHeaderCta).toBeHidden();
      await expect(page.locator(".public-actions .button-secondary")).toBeVisible();
    } else if (width <= 980) {
      await expect(nav).toBeHidden();
      await expect(primaryHeaderCta).toBeVisible();
    } else {
      await expect(nav).toBeVisible();
      await expect(primaryHeaderCta).toBeVisible();
    }
  });
});
