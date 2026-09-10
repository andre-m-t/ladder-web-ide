"""Configuração do serviço, lida do ambiente.

Os caminhos do MATIEC e da toolchain ESP32 são definidos pela imagem do
contêiner (ver `backend/Dockerfile`); sobrescreva-os apenas ao rodar fora do
Docker.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Origens autorizadas no CORS, separadas por vírgula.
    cors_origins: str = "http://localhost:5173"

    # Fronteira com o MATIEC (ver app/services/matiec.py).
    matiec_iec2c_path: str = "/usr/local/bin/iec2c"
    matiec_lib_dir: str = "/usr/local/share/matiec/lib"

    # Fronteira com a toolchain ESP32 (ver app/services/esp32.py).
    # `esp_idf_py_path` pode ser um nome resolvido no PATH ou um caminho absoluto.
    esp_idf_py_path: str = "idf.py"
    esp_project_template: str = "/app/firmware/esp32-template"
    esp_build_root: str = "/var/cache/ladderflow/esp-build"

    log_level: str = "info"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
