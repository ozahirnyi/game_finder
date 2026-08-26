# Persistent business E2E operations

The live suite is opt-in. Pull-request CI continues to run the mocked Playwright
project. Apply the migration before the first seed, then configure credentials
outside the repository:

```powershell
$env:DATABASE_URL = "postgresql://..."
$env:SECRET_KEY = "local-only-secret"
$env:E2E_FIXTURE_EMAIL_DOMAIN = "ops.example.org"
$env:E2E_FIXTURE_MARA_PASSWORD = "<secret>"
$env:E2E_FIXTURE_JONAS_PASSWORD = "<secret>"
python -m scripts.fixture_admin seed --fixture-key local-slate --json
python -m scripts.fixture_admin inspect --fixture-key local-slate --json
python -m scripts.fixture_admin hide --fixture-key local-slate --dry-run --json
python -m scripts.fixture_admin delete --fixture-key local-slate --dry-run --json
python -m scripts.fixture_admin delete --fixture-key local-slate --confirm local-slate --json
```

`delete` is the only hard-delete operation and requires the exact key. Hide is
reversible. Inventory output contains IDs and counts, never passwords or hashes.
The live browser command additionally requires `E2E_BASE_URL` and an exact host
match in `E2E_ALLOWED_HOSTS`; it does not start a local server or install API
fixtures.
