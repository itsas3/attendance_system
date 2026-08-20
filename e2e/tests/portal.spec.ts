import { expect, test, type Page } from "@playwright/test";

const password = "password123";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/");
}

function dashboard(page: Page) {
  return page.getByRole("region", { name: "Portal workspaces" });
}

test("redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
});

test("employee sees only employee dashboard modules", async ({ page }) => {
  await login(page, "employee@e2e.test");
  const modules = dashboard(page);

  await expect(modules.getByRole("heading", { name: "My Attendance", exact: true })).toBeVisible();
  await expect(modules.getByRole("heading", { name: "My Leave Requests" })).toBeVisible();
  await expect(
    modules.getByRole("heading", { name: "My Attendance Correction Requests" })
  ).toBeVisible();
  await expect(modules.getByRole("heading", { name: "Employee Leave Requests" })).toHaveCount(0);
  await expect(modules.getByRole("heading", { name: "Add Employee" })).toHaveCount(0);
});

test("manager sees only pending requests from direct reports", async ({ page }) => {
  await login(page, "manager@e2e.test");
  const modules = dashboard(page);

  await expect(modules.getByRole("heading", { name: "Team Attendance" })).toBeVisible();
  await expect(modules.getByRole("heading", { name: "Employee Leave Requests" })).toBeVisible();
  await expect(
    modules.getByRole("heading", { name: "Employee Attendance Correction Requests" })
  ).toBeVisible();
  await expect(modules.getByText("1 Pending", { exact: true })).toHaveCount(2);
  await expect(modules.getByRole("heading", { name: "Company Attendance" })).toHaveCount(0);
});

test("owner sees organization modules and all pending requests", async ({ page }) => {
  await login(page, "owner@e2e.test");
  const modules = dashboard(page);

  await expect(modules.getByRole("heading", { name: "Employee Leave Requests" })).toBeVisible();
  await expect(
    modules.getByRole("heading", { name: "Employee Attendance Correction Requests" })
  ).toBeVisible();
  await expect(modules.getByRole("heading", { name: "Add Employee" })).toBeVisible();
  await expect(modules.getByRole("heading", { name: "Company Attendance" })).toBeVisible();
  await expect(modules.getByText("3 Pending", { exact: true })).toHaveCount(2);
  await expect(modules.getByRole("heading", { name: "My Attendance" })).toHaveCount(0);
  await expect(modules.getByRole("heading", { name: "My Leave Requests" })).toHaveCount(0);
  await expect(
    modules.getByRole("heading", { name: "My Attendance Correction Requests" })
  ).toHaveCount(0);
});

test("signs out and returns to login", async ({ page }) => {
  await login(page, "employee@e2e.test");

  await page.getByRole("button", { name: "Sign Out" }).click();

  await expect(page).toHaveURL("/login");
  await page.goto("/");
  await expect(page).toHaveURL("/login");
});
