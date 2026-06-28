from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_name: str = "Ubuntu Ops Control Console"
    environment: str = "local"
    database_url: str = "sqlite:///./data/uocc.sqlite3"
    allowlist_path: str = "config/allowlist.example.yaml"
    app_config_path: str = "config/app.example.yaml"
    agent_base_url: str = "http://agent:8787"
    agent_mode: str = "auto"
    agent_timeout_seconds: float = 5.0
    log_default_lines: int = 200
    log_max_lines: int = 1000
    operator_token: str | None = None
    allowed_origins: tuple[str, ...] = ("http://127.0.0.1:3000", "http://localhost:3000")

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            environment=os.getenv("UOCC_ENV", "local"),
            database_url=os.getenv("DATABASE_URL", cls.database_url),
            allowlist_path=os.getenv("ALLOWLIST_PATH", cls.allowlist_path),
            app_config_path=os.getenv("APP_CONFIG_PATH", cls.app_config_path),
            agent_base_url=os.getenv("AGENT_BASE_URL", cls.agent_base_url),
            agent_mode=os.getenv("AGENT_MODE", cls.agent_mode).lower(),
            agent_timeout_seconds=float(os.getenv("AGENT_TIMEOUT_SECONDS", cls.agent_timeout_seconds)),
            log_default_lines=int(os.getenv("LOG_DEFAULT_LINES", cls.log_default_lines)),
            log_max_lines=int(os.getenv("LOG_MAX_LINES", cls.log_max_lines)),
            operator_token=os.getenv("UOCC_OPERATOR_TOKEN") or None,
            allowed_origins=tuple(
                origin.strip()
                for origin in os.getenv("UOCC_ALLOWED_ORIGINS", ",".join(cls.allowed_origins)).split(",")
                if origin.strip()
            ),
        )


settings = Settings.from_env()
