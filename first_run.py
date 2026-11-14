
"""
LaneCove first-run administrator setup.

Only accessible through the local loopback interface.
Allows exactly one initial account to be created when
the auth_users table is empty.
"""

import re

import psycopg
from argon2 import PasswordHasher
from fastapi import FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field

from db_access import get_connection


password_hasher = PasswordHasher()

ALLOWED_HOSTS = {
    "127.0.0.1",
    "localhost",
}

ALLOWED_ORIGINS = {
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}


class FirstRunAccount(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=14, max_length=256)


def check_local_request(request: Request, require_origin=False):
    client_ip = request.client.host if request.client else ""

    if client_ip not in ("127.0.0.1", "::1"):
        raise HTTPException(
            status_code=403,
            detail="First-time setup is available locally only."
        )

    host = request.headers.get("host", "").split(":")[0]

    if host not in ALLOWED_HOSTS:
        raise HTTPException(
            status_code=403,
            detail="Invalid setup host."
        )

    if require_origin:
        origin = request.headers.get("origin")

        if origin not in ALLOWED_ORIGINS:
            raise HTTPException(
                status_code=403,
                detail="Invalid setup origin."
            )

        content_type = request.headers.get(
            "content-type", ""
        ).split(";")[0].strip().lower()

        if content_type != "application/json":
            raise HTTPException(
                status_code=415,
                detail="JSON content type required."
            )


def has_existing_user() -> bool:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT EXISTS (SELECT 1 FROM auth_users) AS found"
                )

                return bool(cur.fetchone()["found"])

    except psycopg.Error as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to check account setup status."
        ) from exc


def install_first_run(app: FastAPI):

    @app.get("/api/auth/setup/status")
    def setup_status(request: Request):
        check_local_request(request)

        return {
            "needs_setup": not has_existing_user()
        }

    @app.post(
        "/api/auth/setup/create",
        status_code=status.HTTP_201_CREATED
    )
    def create_first_account(
        account: FirstRunAccount,
        request: Request
    ):
        check_local_request(
            request,
            require_origin=True
        )

        username = account.username.strip()

        if not re.fullmatch(
            r"[A-Za-z0-9_.-]{3,40}",
            username
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Username must contain 3-40 letters, "
                    "numbers, underscores, dots or hyphens."
                )
            )

        password_hash = password_hasher.hash(
            account.password
        )

        try:
            with get_connection() as conn:
                with conn.cursor() as cur:

                    # Prevent two simultaneous requests
                    # from creating separate initial accounts.
                    cur.execute(
                        "SELECT pg_advisory_xact_lock(%s)",
                        (867530941,)
                    )

                    cur.execute(
                        "SELECT EXISTS "
                        "(SELECT 1 FROM auth_users) AS found"
                    )

                    if cur.fetchone()["found"]:
                        raise HTTPException(
                            status_code=409,
                            detail=(
                                "Initial setup has already "
                                "been completed."
                            )
                        )

                    cur.execute(
                        """
                        INSERT INTO auth_users
                            (username, password_hash, is_active)
                        VALUES (%s, %s, TRUE)
                        """,
                        (username, password_hash)
                    )

        except psycopg.Error as exc:
            raise HTTPException(
                status_code=503,
                detail="Unable to create the account."
            ) from exc

        return {
            "ok": True,
            "message": (
                "Account created successfully. "
                "Please sign in."
            )
        }
