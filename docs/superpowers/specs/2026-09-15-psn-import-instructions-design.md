# PSN import instructions design

## Goal

Help a player obtain the PlayStation data export required by the existing library-import flow without taking them away from the import page.

## Placement and interaction

On the `/psn-import` upload step, add a compact, collapsed `details` panel between the page introduction and the upload control. Its summary is **How to get your PlayStation export**. The player can open it before choosing a file; it does not change the import step, file picker, or request flow.

## Instruction content

The expanded panel presents a short ordered list:

1. Sign in to PlayStation Account Management.
2. Open **Privacy Settings** and select **Data Access Requests → Request Data**.
3. Wait for Sony's email that says the export is ready, then use its download link to save the Excel file.
4. Return here and choose that file.

Include an external **Open PlayStation instructions** link to PlayStation's official data-access article. State that Sony may take up to seven days to send the download email and that its download link is available for seven days. The existing accepted-format text remains visible: `.xlsx`, `.csv`, or `.json`, up to 10 MB.

## Accessibility and safety

- Use native `details`/`summary` semantics for keyboard and screen-reader access.
- The official link opens in a new tab with `rel="noreferrer"`.
- Do not request PlayStation credentials or add a new API call. The user uploads the file only through the existing import control.

## Verification

- Add a route test that renders the import page and asserts the guidance summary, the core navigation text, and the official external-link URL.
- Keep existing upload behaviour covered by the current route tests.
