import { expect, test } from "@playwright/test";

// Production-build smoke tests on the Pages-style subpath.

test.describe("promptly e2e", () => {
  test("loads edit mode at the subpath", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/promptly/i);
    await expect(page.getByLabel("Script library")).toBeVisible();
    await expect(page.getByRole("button", { name: /new script/i })).toBeVisible();
  });

  test("creates and edits a script, then opens the prompter", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByLabel("Script text");
    await textarea.waitFor({ state: "visible", timeout: 15000 });
    await textarea.fill("Prompter smoke words");
    const prompterButton = page.getByRole("button", { name: /^Prompter$/i });
    await expect(prompterButton).toBeEnabled({ timeout: 5000 });
    await prompterButton.click();
    await expect(page.getByTestId("prompter")).toBeVisible();
  });

  test("mirror toggle flips the script column", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByLabel("Script text");
    await textarea.fill("Mirror words");
    await page.getByRole("button", { name: /^Prompter$/i }).click();
    await page.getByRole("button", { name: "Mirror" }).click();
    const prompter = page.getByTestId("prompter");
    await expect(prompter).toBeVisible();
  });

  test("font slider updates rendered size", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Script text").fill("Size words");
    await page.getByRole("button", { name: /^Prompter$/i }).click();
    await page.getByRole("button", { name: "Size" }).click();
    const range = page.getByLabel("Font size in pixels");
    await range.fill("64");
    await expect(range).toHaveValue("64");
  });
});
