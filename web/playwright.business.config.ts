import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL?.trim();
const allowedHosts = (process.env.E2E_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

if (!baseURL) {
  throw new Error("E2E_BASE_URL is required for business E2E and no browser was started");
}

let parsed: URL;
try {
  parsed = new URL(baseURL);
} catch {
  throw new Error("E2E_BASE_URL must be an absolute URL");
}
if (!allowedHosts.length || !allowedHosts.includes(parsed.host.toLowerCase())) {
  throw new Error("E2E_BASE_URL is not present in E2E_ALLOWED_HOSTS; refusing live mutations");
}

export default defineConfig({
  testDir: "./e2e-business",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [["line"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "business-chromium", use: { ...devices["Desktop Chrome"] } }],
});
