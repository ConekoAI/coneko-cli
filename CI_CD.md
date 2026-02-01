# Coneko CI/CD

This directory contains CI/CD configurations for the Coneko project.

## Structure

```
coneko-cli/                 # CLI package (public, published to NPM)
├── .github/workflows/
│   └── publish.yml         # Test & Publish workflow
├── Dockerfile.test         # Test container
├── docker-compose.e2e.yml  # E2E test environment (uses ../coneko-service)
├── CI_CD.md               # This file
└── tests/e2e/             # E2E tests

coneko-service/            # Service package (private, EC2 deploy)
├── .github/workflows/
│   └── deploy.yml         # Test & Deploy workflow
└── Dockerfile.test        # Test container
```

## Workflows

### coneko-cli (Publish to NPM)

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main`
- Version tags (`v*.*.*`)

**Pipeline:**
1. Unit Tests
2. E2E Tests (requires coneko-service)
3. Publish to NPM (only on version tags)

### coneko-service (Deploy to EC2)

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main`

**Pipeline:**
1. Unit Tests
2. E2E Tests (requires coneko-cli)
3. Deploy to EC2 (only on `main` branch)

## E2E Testing

The E2E tests spin up a full environment:
- PostgreSQL database
- coneko-service API
- coneko-cli tests

### Prerequisites for Local E2E

Clone both repos side by side:
```bash
git clone https://github.com/ConekoAI/coneko-cli.git
git clone https://github.com/ConekoAI/coneko-service.git  # Private repo
```

### Running E2E Tests Locally

```bash
cd coneko-cli

# Run E2E tests (builds everything, runs tests, cleans up)
docker compose -f docker-compose.e2e.yml up --build --abort-on-container-exit

# Watch mode (keeps containers running for debugging)
docker compose -f docker-compose.e2e.yml up --build

# Clean up
docker compose -f docker-compose.e2e.yml down -v

# View logs
docker compose -f docker-compose.e2e.yml logs -f
```

## Required Secrets

### coneko-cli Repository

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | NPM automation token for publishing |

### coneko-service Repository

Configure at **Settings → Environments → coneko:prod**:

| Secret | Description |
|--------|-------------|
| `EC2_HOST` | EC2 instance IP or hostname |
| `EC2_USER` | SSH username (default: ec2-user) |
| `EC2_SSH_KEY` | SSH private key for deployment |
| `EC2_PORT` | SSH port (default: 22) |

**Environment Protection Rules** (recommended):
- Required reviewers: 1 (for manual approval before deploy)
- Deployment branches: `main` only
- Wait timer: Optional (add delay before deploy)

### Cross-Repository Access

The E2E tests need to checkout the other repository. Make sure:
1. Both repos are in the same GitHub organization/user
2. The workflow uses `secrets.GITHUB_TOKEN` which has access to both repos

## NPM Publishing

To publish a new version:

```bash
cd coneko-cli
npm version patch  # or minor, major
npm run build
git push origin main --tags
```

The GitHub Action will automatically publish when a version tag is pushed.

## EC2 Deployment

The service deploys to EC2 using PM2 for process management. Ensure the EC2 instance has:

1. Node.js 18+ installed
2. PM2 installed globally: `npm install -g pm2`
3. PostgreSQL accessible
4. Environment variables in `/opt/coneko-service/.env`

### First-Time EC2 Setup

Use the provided setup script:

```bash
scp coneko-service/deploy/ec2-setup.sh ubuntu@your-ec2-ip:~
ssh ubuntu@your-ec2-ip
chmod +x ec2-setup.sh
./ec2-setup.sh
```

## Troubleshooting

### E2E Tests Fail in CI

1. Check that both repos are accessible
2. Verify the health endpoint is responding
3. Check artifact uploads for test results

### NPM Publish Fails

1. Verify Trusted Publisher is configured in npm (Settings → Publishing access → Add GitHub Actions workflow)
2. Check package version is unique
3. Verify `id-token: write` permission is set in the workflow
3. Ensure build succeeds before publish

### EC2 Deploy Fails

1. Verify SSH key and host are correct
2. Check EC2 security group allows SSH
3. Ensure target directory exists and is writable
4. Check PM2 logs on the server: `pm2 logs coneko-service`
