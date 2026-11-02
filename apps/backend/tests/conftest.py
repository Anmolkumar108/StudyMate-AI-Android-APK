from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


def pytest_runtest_setup(item: pytest.Item) -> None:
    """Automatically skip tests marked with @pytest.mark.integration unless enabled."""
    if item.get_closest_marker("integration") is not None:
        from tests.db_test_config import is_integration_test_enabled

        if not is_integration_test_enabled():
            pytest.skip(
                "PostgreSQL integration tests disabled. Set RUN_POSTGRES_INTEGRATION=1 to run."
            )
