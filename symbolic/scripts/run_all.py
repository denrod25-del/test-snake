"""Launch every SYMBOLIC service in one process group.

Each microservice runs in its own subprocess. Ctrl+C stops them all.

Run: python scripts/run_all.py
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGES = ROOT / "packages"

SERVICES = [
    ("symbolic_ads.main:app",       int(os.getenv("SYMBOLIC_ADS_PORT", "8001"))),
    ("symbolic_analytics.main:app", int(os.getenv("SYMBOLIC_ANALYTICS_PORT", "8002"))),
    ("symbolic_console.main:app",   int(os.getenv("SYMBOLIC_CONSOLE_PORT", "8003"))),
    ("symbolic_api.main:app",       int(os.getenv("SYMBOLIC_API_PORT", "8000"))),
]


def main() -> None:
    env = os.environ.copy()
    pythonpath = str(PACKAGES)
    if env.get("PYTHONPATH"):
        pythonpath = pythonpath + os.pathsep + env["PYTHONPATH"]
    env["PYTHONPATH"] = pythonpath
    env.setdefault("SYMBOLIC_DATA_DIR", str(ROOT / "data"))

    procs: list[subprocess.Popen] = []
    try:
        for app, port in SERVICES:
            cmd = [
                sys.executable, "-m", "uvicorn", app,
                "--host", "0.0.0.0",
                "--port", str(port),
                "--log-level", "info",
            ]
            print(f"  -> {app}  =>  http://localhost:{port}")
            p = subprocess.Popen(cmd, env=env, cwd=str(ROOT))
            procs.append(p)
            time.sleep(0.4)

        print()
        print("SYMBOLIC is up.")
        print(f"  Search UI:  http://localhost:{SERVICES[3][1]}")
        print(f"  Console:    http://localhost:{SERVICES[2][1]}")
        print("  Press Ctrl+C to stop.")
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        for p in procs:
            try:
                if os.name == "nt":
                    p.send_signal(signal.CTRL_BREAK_EVENT)
                else:
                    p.terminate()
            except Exception:
                pass
        for p in procs:
            try:
                p.wait(timeout=5)
            except Exception:
                p.kill()


if __name__ == "__main__":
    main()
