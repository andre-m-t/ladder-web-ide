"""Configuração do serviço, lida do ambiente.

Os caminhos do MATIEC são definidos pela imagem do contêiner (ver
`backend/Dockerfile`); sobrescreva-os apenas ao rodar fora do Docker.
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

    log_level: str = "info"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
