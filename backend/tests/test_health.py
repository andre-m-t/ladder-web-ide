from fastapi.testclient import TestClient


def test_health_responde_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "available" in body["iec2c"]
    assert "path" in body["iec2c"]
