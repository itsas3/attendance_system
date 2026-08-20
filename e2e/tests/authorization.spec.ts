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

test.describe("Manager Scoped Team Authorization", () => {
  test("Manager 2 only sees data and requests from their own direct reports", async ({ page }) => {
    // 1. Log in as Manager 2 (who manages Employee 2 in Operations)
    await login(page, "manager-2@e2e.test");
    const modules = dashboard(page);

    // Assert that Team-level modules are visible, but Company-level ones are hidden
    await expect(modules.getByRole("heading", { name: "Team Attendance" })).toBeVisible();
    await expect(modules.getByRole("heading", { name: "Employee Leave Requests" })).toBeVisible();
    await expect(
      modules.getByRole("heading", { name: "Employee Attendance Correction Requests" })
    ).toBeVisible();
    await expect(modules.getByRole("heading", { name: "Company Attendance" })).toHaveCount(0);

    // Verify Manager 2 sees exactly 1 pending request for both Leave and Corrections (Employee 2's requests)
    // If it was leaking Employee 1's requests, the count would be 2.
    await expect(modules.getByText("1 Pending", { exact: true })).toHaveCount(2);

    // 2. Verify Team Management List Isolation
    await page.goto("/team-management");
    // Verify Employee 2 is visible in Manager 2's team list
    await expect(page.getByText("E2E Employee 2")).toBeVisible();
    await expect(page.getByText("employee-2@e2e.test")).toBeVisible();
    // Verify Employee 1 (from Engineering) is NOT visible to Manager 2
    await expect(page.getByText("E2E Employee", { exact: true })).toHaveCount(0);
    await expect(page.getByText("employee@e2e.test")).toHaveCount(0);

    // 3. Verify Leave Requests List Isolation
    await page.goto("/employee-leave-requests");
    // Manager 2 should see Employee 2's leave request reason
    await expect(page.getByText("Manager 2-visible E2E leave")).toBeVisible();
    // Manager 2 should NOT see Employee 1's leave request reason
    await expect(page.getByText("Manager-visible E2E leave")).toHaveCount(0);
  });

  test("Manager 1 only sees data and requests from their own direct reports", async ({ page }) => {
    // 1. Log in as Manager 1 (who manages Employee 1 in Engineering)
    await login(page, "manager@e2e.test");
    const modules = dashboard(page);

    // Verify Manager 1 sees exactly 1 pending request for both (Employee 1's requests)
    await expect(modules.getByText("1 Pending", { exact: true })).toHaveCount(2);

    // 2. Verify Team Management List Isolation
    await page.goto("/team-management");
    // Verify Employee 1 is visible
    await expect(page.getByText("E2E Employee")).toBeVisible();
    await expect(page.getByText("employee@e2e.test")).toBeVisible();
    // Verify Employee 2 is NOT visible
    await expect(page.getByText("E2E Employee 2")).toHaveCount(0);
    await expect(page.getByText("employee-2@e2e.test")).toHaveCount(0);

    // 3. Verify Leave Requests List Isolation
    await page.goto("/employee-leave-requests");
    // Manager 1 should see Employee 1's leave request reason
    await expect(page.getByText("Manager-visible E2E leave")).toBeVisible();
    // Manager 1 should NOT see Employee 2's leave request reason
    await expect(page.getByText("Manager 2-visible E2E leave")).toHaveCount(0);
  });

  test("Manager 2 is blocked from viewing Manager 1's direct report's employee notes history directly via URL", async ({
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

    // 2. Log in as Manager 2 (Company A, managing Employee 2)
    await login(page, "manager-2@e2e.test");

    // Try to visit Employee 1's notes history page directly
    await page.goto(href!);

    // Verify it is not found (404)
    await expect(page.getByText("This page could not be found")).toBeVisible();
  });
});
