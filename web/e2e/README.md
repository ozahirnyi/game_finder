# Playwright E2E tests

Run the commands below from `web/`.

## Install and run

```bash
npm install
npx playwright install chromium
npm run test:ui
npm run test:ui:headed
```

`test:ui` runs headlessly. `test:ui:headed` opens Chromium for interactive debugging.

## Reports, traces, and screenshots

After a failed run, open the HTML report with:

```bash
npx playwright show-report
```

To collect a trace and screenshots while debugging, rerun the relevant test with both enabled:

```bash
npx playwright test e2e/<spec>.spec.ts --trace on --screenshot on
```

Open an archived trace with:

```bash
npx playwright show-trace test-results/<test-result>/trace.zip
```

Failure screenshots and trace archives are written below `test-results/`; they are local debugging artifacts and must not be committed.

## Fixture and network policy

E2E tests use immutable fixture data and route every API call through `e2e/fixtures/`. Do not call live APIs, reuse production credentials, or make a test depend on external state. Add a narrowly scoped fixture handler for each API interaction; unmocked `/api/` calls deliberately receive a diagnostic response.

## Debugging rules

- Reproduce with the smallest relevant spec before changing a test or fixture.
- Keep fixture data deterministic; never mutate shared fixture definitions between tests.
- Use headed mode, the HTML report, screenshots, and traces to diagnose a failure.
- Fix the application or the explicitly modeled fixture contract; do not weaken expectations merely to make a test pass.
