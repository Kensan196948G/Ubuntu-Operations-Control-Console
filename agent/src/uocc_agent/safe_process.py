from __future__ import annotations

import subprocess

from .config import settings


def run_fixed(
    args: list[str],
    timeout: int | None = None,
    input_text: str | None = None,
    strip: bool = True,
) -> tuple[int, str, str]:
    completed = subprocess.run(
        args,
        check=False,
        capture_output=True,
        text=True,
        input=input_text,
        timeout=timeout or settings.command_timeout_seconds,
    )
    stdout = completed.stdout.strip() if strip else completed.stdout
    stderr = completed.stderr.strip() if strip else completed.stderr
    return completed.returncode, stdout, stderr
