# Lightsail SSH Deployment Design

## Goal

Deploy Game Finder to the existing Lightsail instance from GitHub Actions without CodeDeploy, so releases work while the AWS account is on the Free plan.

## Architecture

The production host runs the FastAPI application, PostgreSQL, Redis, and Nginx through Docker Compose. The application port binds only to `127.0.0.1`; Nginx remains the only public HTTP(S) entry point.

On a push to `main`, GitHub Actions runs the existing test suite, connects to the host using a dedicated SSH deploy key stored in GitHub Secrets, updates a checked-out release directory, builds the Compose application, applies Alembic migrations, and validates the local health endpoint. The workflow receives no AWS access keys and does not use S3, SSM, or CodeDeploy.

## Components

- `docker-compose.lightsail.yml` defines application, PostgreSQL, and Redis production services, persistent volumes, and local-only application exposure.
- `infra/lightsail/nginx/game-finder.conf` proxies the configured API host to `127.0.0.1:8000` and supplies standard forwarding headers.
- `scripts/deploy/ssh_deploy.sh` is an idempotent host-side release script: it installs the current revision, builds services, migrates, starts Compose, and checks `/health`.
- `.github/workflows/deploy-lightsail-ssh.yml` runs tests, verifies the required SSH connection variables, and executes the host-side script remotely.
- GitHub Secrets hold `LIGHTSAIL_HOST`, `LIGHTSAIL_SSH_PRIVATE_KEY`, and application environment values. No secret is committed.

## Security and Operations

- Use a separate deploy key restricted to the GitHub repository and the `ec2-user` account. Disable password authentication for the deploy path.
- SSH is restricted by the Lightsail firewall; database and Redis ports are never public.
- Deployment stops on test, build, migration, Compose, or health-check failure. The previous image remains usable if a new build fails before Compose is restarted.
- The initial release uses the instance static IPv4. HTTPS activation remains deferred until the user provides a real domain name.

## Testing

- Run `pytest -q` before deployment.
- Validate the Compose file with `docker compose ... config --quiet` using a temporary non-secret environment file.
- Run shell syntax checks in the GitHub Actions Ubuntu runner.
- Verify deployment with `curl --fail http://127.0.0.1:8000/health` on the host.

## Migration Path

CodeDeploy configuration can be added later without changing the Compose, Nginx, database, or application layout. Only the GitHub Actions delivery job is replaced.
