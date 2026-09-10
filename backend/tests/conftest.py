from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def minimal_st() -> str:
    return (FIXTURES_DIR / "minimal.st").read_text(encoding="utf-8")
