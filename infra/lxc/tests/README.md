# Config-Manager Test Suite

Comprehensive testing suite for the LXC config-manager using BATS (Bash Automated Testing System), Docker, and GitHub Actions.

## Overview

Tests are organized in three layers:

| Layer           | What                        | Tools            | Catches                                               |
| --------------- | --------------------------- | ---------------- | ----------------------------------------------------- |
| **Lint**        | shellcheck on all scripts   | shellcheck       | Syntax errors, quoting bugs, undefined vars           |
| **Unit**        | Individual function testing | BATS + Docker    | Logic bugs in helpers, detection, file processing     |
| **Integration** | Full config-manager sync    | Docker + systemd | ProtectSystem issues, user creation, path permissions |

## Running Tests Locally

### Prerequisites

- Docker (with daemon running)
- Optional: `act` for running GitHub Actions locally

### Run All Tests

```bash
cd infra/lxc/tests
./run-tests.sh
```

### Run Specific Test Suites

```bash
./run-tests.sh lint          # ShellCheck only (fast)
./run-tests.sh unit          # Unit tests only
./run-tests.sh integration   # Integration tests only (requires privileged Docker)
./run-tests.sh act           # Run via act (GitHub Actions locally)
```

## CI/CD

Tests run automatically on:

- Push to `main` affecting `infra/lxc/**`
- Pull requests to `main` affecting `infra/lxc/**`

Workflow: `.github/workflows/test-config-manager.yml`

## Test Structure

```
infra/lxc/tests/
├── Dockerfile.unit              # Lightweight Ubuntu 24.04 for unit/lint tests
├── Dockerfile.integration       # Ubuntu 24.04 with systemd for integration tests
├── docker-compose.yml           # Orchestrates all test targets
├── run-tests.sh                 # Local convenience runner
├── bats-helpers.bash            # Shared BATS test utilities
│
├── lint/
│   └── test-shellcheck.bats     # shellcheck on all .sh files
│
├── unit/
│   └── test-helpers.bats        # config-manager-helpers.sh functions
│
├── integration/
│   ├── test-user-setup.bats     # 01-setup-user.sh end-to-end
│   └── test-service-permissions.bats  # ProtectSystem=strict verification
│
└── fixtures/
    ├── config.env               # Minimal test configuration
    ├── os-release               # Mock /etc/os-release for Ubuntu 24.04
    └── mock-repo/               # Simulated git repo structure
```

## Bugs These Tests Catch

| Bug                                        | Test That Catches It                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `/etc/sudoers.d` read-only (ProtectSystem) | `test-service-permissions.bats` + `test-user-setup.bats`                   |
| `chown: invalid user: 'coder:coder'`       | `test-user-setup.bats::chown works after user creation`                    |
| `/etc/systemd/system` read-only            | `test-service-permissions.bats::scripts that write to /etc/systemd/system` |
| Missing helper functions in scripts        | Unit tests verify function availability                                    |
| Package handler routing                    | Unit tests verify correct handler dispatch                                 |

## Adding New Tests

### Lint Tests

Add test cases to `lint/test-shellcheck.bats`. Each script should have its own `@test` block.

### Unit Tests

1. Create a new `.bats` file in `unit/`
2. Load helpers: `load '../bats-helpers'`
3. Use BATS assertions from `bats-assert` library

### Integration Tests

1. Create a new `.bats` file in `integration/`
2. Tests run inside a systemd-enabled Docker container
3. Can test real user creation, sudoers, service installations

## Troubleshooting

### Docker Permission Denied

If you get permission errors running Docker, try with `sudo`:

```bash
sudo ./run-tests.sh
```

Or add your user to the `docker` group:

```bash
sudo usermod -aG docker $USER
# Log out and back in
```

### Integration Tests Fail

Integration tests require:

- Privileged Docker containers
- `/sys/fs/cgroup` mount
- systemd support

If running on macOS/Windows, integration tests may not work (use CI or Linux host).

### Tests Hang

If tests hang indefinitely:

1. Check Docker daemon is running
2. Try rebuilding images: `docker compose -f docker-compose.yml build --no-cache`
3. Clean up dangling containers: `docker ps -a | grep cm-test`

## Contributing

When adding new config-manager features:

1. Add corresponding unit tests
2. Add integration tests for system-level changes
3. Run full test suite locally before PR
4. Ensure CI passes on PR

## Links

- [BATS Core](https://github.com/bats-core/bats-core)
- [BATS Support](https://github.com/bats-core/bats-support)
- [BATS Assert](https://github.com/bats-core/bats-assert)
- [act - Run GitHub Actions Locally](https://github.com/nektos/act)
