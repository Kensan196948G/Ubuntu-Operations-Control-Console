from __future__ import annotations

import subprocess

from .config import settings


def run_fixed(args: list[str], timeout: int | None = None) -> tuple[int, str, str]:
    completed = subprocess.run(
        args,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout or settings.command_timeout_seconds,
    )
    return completed.returncode, completed.stdout.strip(), completed.stderr.strip()

