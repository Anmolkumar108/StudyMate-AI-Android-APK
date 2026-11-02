import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(async_client: AsyncClient) -> None:
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "health_check" in data
    assert data["health_check"] == "/api/v1/health"


@pytest.mark.asyncio
async def test_health_check_endpoint(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "StudyMate AI"
    assert data["environment"] in ["development", "staging", "production"]
    assert data["version"] == "0.1.0"
    assert data["database"] == "connected"
