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

test.describe("Cross-Tenant Data Isolation", () => {
  // 1. MANAGER ISOLATION TESTS
  test("Manager from Company B (Organization 2) is blocked from seeing Company A's data", async ({
    page
  }) => {
    await login(page, "manager-3@e2e.test");
    const modules = dashboard(page);

    // Verify they only see their own direct reports' pending requests (1 Pending)
    await expect(modules.getByText("1 Pending", { exact: true })).toHaveCount(2);

    // Verify Team Management List Isolation
    await page.goto("/team-management");
    await expect(page.getByText("E2E Employee 3")).toBeVisible();
    await expect(page.getByText("E2E Employee", { exact: true })).toHaveCount(0);
    await expect(page.getByText("E2E Employee 2")).toHaveCount(0);

    // Verify Leave Requests Isolation
    await page.goto("/employee-leave-requests");
    await expect(page.getByText("Organization 2 E2E leave")).toBeVisible();
    await expect(page.getByText("Manager-visible E2E leave")).toHaveCount(0);
  });

  test("Manager from Company A (Organization 1) is blocked from seeing Company B's data", async ({
    page
  }) => {
    await login(page, "manager@e2e.test");
    const modules = dashboard(page);

    // Verify they only see their own direct reports' pending requests (1 Pending)
    await expect(modules.getByText("1 Pending", { exact: true })).toHaveCount(2);

    // Verify Team Management List Isolation
    await page.goto("/team-management");
    await expect(page.getByText("E2E Employee")).toBeVisible();
    await expect(page.getByText("E2E Employee 3")).toHaveCount(0);

    // Verify Leave Requests Isolation
    await page.goto("/employee-leave-requests");
    await expect(page.getByText("Manager-visible E2E leave")).toBeVisible();
    await expect(page.getByText("Organization 2 E2E leave")).toHaveCount(0);
  });

  // 2. DIRECT URL CROSS-TENANT BYPASS TEST
  test("Manager from Company B is blocked from viewing Company A's employee notes history directly via URL", async ({
    page
  }) => {
    // 1. Log in as Manager 1 (Company A) to discover Employee 1's notes URL
    await login(page, "manager@e2e.test");
    await page.goto("/team-management");

    const employeeRow = page.locator("article", { hasText: "E2E Employee" });
    const notesLink = employeeRow.locator('a[title="Previous Notes"]');
    const href = await notesLink.getAttribute("href");
    expect(href).not.toBeNull();

    // Sign out
    await page.getByRole("button", { name: "Sign Out" }).click();

    // 2. Log in as Manager 3 (Company B)
    await login(page, "manager-3@e2e.test");

    // Try to visit Company A Employee's notes history page directly
    await page.goto(href!);

    // Verify it is not found (404)
    await expect(page.getByText("This page could not be found")).toBeVisible();
  });

  // 3. OWNER ISOLATION TESTS
  test("Owner from Company A (Organization 1) is blocked from seeing Company B's data", async ({
    page
  }) => {
    await login(page, "owner@e2e.test");

    // Verify Team Management List Isolation
    await page.goto("/team-management");
    await expect(page.getByText("E2E Employee", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E Employee 2")).toBeVisible();
    await expect(page.getByText("E2E Employee 3")).toHaveCount(0);

    // Verify Leave Requests List Isolation
    await page.goto("/employee-leave-requests");
    await expect(page.getByText("Manager-visible E2E leave")).toBeVisible();
    await expect(page.getByText("Organization 2 E2E leave")).toHaveCount(0);
  });

  // 4. EMPLOYEE ISOLATION TESTS
  test("Employee from Company B (Organization 2) is blocked from accessing Company A's views", async ({
    page
  }) => {
    await login(page, "employee-3@e2e.test");

    // Verify they are blocked from Team Management
    await page.goto("/team-management");
    await expect(page).toHaveURL("/");

    // Verify they are blocked from Leave Approvals page
    await page.goto("/employee-leave-requests");
    await expect(page.getByText("Unauthorized:", { exact: false })).toBeVisible();
  });
});
