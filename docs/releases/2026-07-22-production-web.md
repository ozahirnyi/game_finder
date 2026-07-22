# Production web source capture — 2026-07-22

The `web` source in this release was captured directly from the active Railway production container before connecting it to GitHub.

- Railway project: `b751dee3-5ce1-4b1f-badd-d4482373bcc6`
- Environment: `production` (`d71dd7e3-cdf5-4692-98c6-715f2db79fd3`)
- Service: `web` (`8539960e-4ab0-478d-9a0a-6db509f2fe68`)
- Deployment: `e704ec7a-7aca-4ab7-9dca-c8e52a47bdcf`
- Deployment image digest: `sha256:a487f173027dfabf121e939aab5c36139c13c1fb584ab583c4ebba154a155e07`
- Capture method: read-only archive of `/app` through Railway SSH.

## File hashes at capture

| File | SHA-256 |
| --- | --- |
| `web/package.json` | `23752074004E4CBD4FE1B402FF86C7DD765024135238D73AB438650ED24A7839` |
| `web/package-lock.json` | `591F563308852056E2C79F20735E72F1D77B4BE8A35336E4A6B5946D4C75CB08` |
| `web/Dockerfile` | `85D452615698B40B2759839ADD4CE06F23BFEC3E46324F27F5E853C47208D174` |

Generated runtime directories were excluded from the archive: `node_modules`, `.next`, `.output`, `.tanstack`, and `.wrangler`. Railway rebuilds them from the committed source and lockfile.
