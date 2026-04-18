<!-- generated-by: gsd-doc-writer -->
# Testing

## Test framework and setup

The backend testing framework is **Pytest**. 
The frontend (`client/`) currently does not have a testing framework configured.

**Backend Setup:**
- The server uses `pytest` alongside `pytest-asyncio` for async test support.
- Dependencies are defined in `server/pyproject.toml` under `[project.optional-dependencies] dev` (`pytest`, `pytest-asyncio`).
- Pytest is configured in `server/pyproject.toml` with `asyncio_mode = "auto"`.

## Running tests

You can run the test suite for the server backend by executing the following commands:

```bash
cd server

# Run all tests
uv run pytest

# Run tests with verbose output
uv run pytest -v

# Run a specific test file
uv run pytest tests/test_trading.py
```

## Writing new tests

- **Location:** All backend tests are located in the `server/tests/` directory.
- **Naming Convention:** Test files must follow the `test_*.py` naming convention (e.g., `test_trading.py`, `test_simulation.py`).
- **Helpers:** The `server/tests/conftest.py` file provides shared test setups, fixtures, and dependencies for test files.

## Coverage requirements

No coverage threshold configured. 

## CI integration

Currently, there is no automated test execution in the CI/CD pipeline (`.github/workflows/deploy-backend.yml`). Tests must be run manually locally.
