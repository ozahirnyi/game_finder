# PSN Import Instructions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise, expandable guide to obtaining a PlayStation data export on the PSN library-import upload screen.

**Architecture:** Keep the guide entirely in the existing upload-step UI in `PsnImportPage`. Use native `details` and `summary` elements for accessible disclosure, with a fixed external link to Sony's official data-access article. Extend the existing route test suite; no API, data model, or import-flow changes are needed.

**Tech Stack:** React 19, TypeScript, TanStack Router, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Show the guide only on `/psn-import` while the import step is `upload`.
- Use native `details`/`summary`; keep the panel collapsed by default.
- The guidance link must use `target="_blank"` and `rel="noreferrer"`.
- Do not add an API call, ask for credentials, or alter accepted formats: `.xlsx`, `.csv`, `.json`, up to 10 MB.
- Copy must say Sony can take up to seven days to email the export and that the download link is valid for seven days.

---

## File structure

- `web/src/routes/psn-import.tsx` — existing PSN import UI; receives the expandable guide on the upload step.
- `web/src/routes/-psn-import.test.tsx` — route-level UI tests; receives coverage for the guide copy and official link.

### Task 1: Add and test the on-page export guide

**Files:**
- Modify: `web/src/routes/-psn-import.test.tsx:65-98`
- Modify: `web/src/routes/psn-import.tsx:240-263`

**Interfaces:**
- Consumes: the existing `step === "upload"` conditional and Testing Library's `screen` query API.
- Produces: an accessible, collapsed `<details>` guide headed **How to get your PlayStation export**, and an official external link with the exact URL `https://www.playstation.com/en-us/support/account/data-request/`.

- [x] **Step 1: Write the failing test**

Add this test as the first case in `describe("PsnImportPage", ...)`:

```tsx
  it("shows instructions for obtaining a PlayStation export before upload", async () => {
    renderPage();

    expect(screen.getByText("How to get your PlayStation export")).toBeInTheDocument();
    expect(
      screen.getByText("Privacy Settings", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(/up to seven days/i)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Open PlayStation instructions" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.playstation.com/en-us/support/account/data-request/",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `rtk npm test -- src/routes/-psn-import.test.tsx`

Expected: FAIL because `How to get your PlayStation export` is absent from the upload screen.

- [x] **Step 3: Add the minimal upload-step guide**

Inside the `step === "upload"` branch in `web/src/routes/psn-import.tsx`, add this `details` panel immediately before the existing `Panel` containing the file picker:

```tsx
          <details className="mb-4 rounded-xl border border-border bg-surface-2 p-4">
            <summary className="cursor-pointer font-bold">How to get your PlayStation export</summary>
            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Sign in to PlayStation Account Management.</li>
                <li>
                  Open <strong>Privacy Settings</strong>, then choose <strong>Data Access Requests → Request Data</strong>.
                </li>
                <li>
                  Wait for Sony&apos;s email that says your export is ready, then use its download link to save the Excel file.
                </li>
                <li>Return here and choose the downloaded file.</li>
              </ol>
              <p>Sony can take up to seven days to send the email; its download link is valid for seven days.</p>
              <a
                href="https://www.playstation.com/en-us/support/account/data-request/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex font-semibold text-primary underline underline-offset-4"
              >
                Open PlayStation instructions
              </a>
            </div>
          </details>
```

- [x] **Step 4: Run the focused test to verify it passes**

Run: `rtk npm test -- src/routes/-psn-import.test.tsx`

Expected: PASS with the new guide test and the existing import-flow tests.

- [x] **Step 5: Run the production build**

Run: `rtk npm run build`

Expected: exit code 0 and Vite completes the production build.

- [x] **Step 6: Commit the implementation**

```bash
rtk git add web/src/routes/psn-import.tsx web/src/routes/-psn-import.test.tsx docs/superpowers/plans/2026-09-15-psn-import-instructions.md
rtk git commit -m "feat: guide PSN export import"
```

## Self-review

- Spec coverage: Task 1 covers the collapsed in-page placement, official flow, up-to-seven-day note, seven-day link lifetime, accepted-format preservation, safe external link, and UI-test requirement. No backend work is in scope.
- Placeholder scan: no TODO/TBD or unspecified testing steps.
- Type consistency: no new types or interfaces are introduced.
