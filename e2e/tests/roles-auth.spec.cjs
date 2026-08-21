const { test, expect } = require("@playwright/test");

const roles = [
  {
    name: "admin",
    emailEnv: "E2E_ADMIN_EMAIL",
    passwordEnv: "E2E_ADMIN_PASSWORD",
    destination: "/admin",
  },
  {
    name: "professor",
    emailEnv: "E2E_TEACHER_EMAIL",
    passwordEnv: "E2E_TEACHER_PASSWORD",
    destination: "/professor",
  },
  {
    name: "família",
    emailEnv: "E2E_GUARDIAN_EMAIL",
    passwordEnv: "E2E_GUARDIAN_PASSWORD",
    destination: "/familia",
  },
  {
    name: "aluno",
    emailEnv: "E2E_STUDENT_EMAIL",
    passwordEnv: "E2E_STUDENT_PASSWORD",
    destination: "/aluno",
  },
];

for (const role of roles) {
  test(`${role.name} entra no portal correto quando credenciais E2E estão configuradas`, async ({ page }) => {
    const email = process.env[role.emailEnv];
    const password = process.env[role.passwordEnv];

    test.skip(!email || !password, `Configure ${role.emailEnv} e ${role.passwordEnv}.`);

    await page.goto("/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /^entrar$/i }).click();

    await expect(page).toHaveURL(new RegExp(`${role.destination.replace("/", "\\/")}(?:\\/|$)`));
  });
}
