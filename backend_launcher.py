
"""
LaneCove Desktop Backend Launcher

Starts the FastAPI application locally.
This will later be packaged as a Windows executable.
"""

import multiprocessing
import uvicorn

from api import app


def main():
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=False,
        workers=1,
        log_level="info",
    )


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
