
import hashlib
import os
import re
import secrets

from datetime import datetime, timedelta, timezone

import psycopg

from argon2 import PasswordHasher
from fastapi import HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from db_access import get_connection


PASSWORD_HASHER = PasswordHasher()

COOKIE_NAME = "silvanne_session"
SESSION_HOURS = 24 * 30
LOGIN_LIMIT = 5

ALLOWED_ORIGINS = {
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
}

# Used to avoid a faster response for unknown usernames.
DUMMY_HASH = PASSWORD_HASHER.hash(
    "silvanne-placeholder-not-a-real-password"
)


def token_digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


def check_password(password: str, stored_hash: str) -> bool:
    try:
        return PASSWORD_HASHER.verify(
            stored_hash,
            password
        )
    except Exception:
        return False


def initialize_auth_database():
    with get_connection() as conn:
        with conn.cursor() as cur:

            cur.execute("""
                CREATE TABLE IF NOT EXISTS auth_users (
                    id BIGSERIAL PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL
                        DEFAULT NOW()
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id BIGINT NOT NULL
                        REFERENCES auth_users(id)
                        ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL
                        DEFAULT NOW(),
                    expires_at TIMESTAMPTZ NOT NULL
                )
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS
                    idx_auth_sessions_expires
                ON auth_sessions(expires_at)
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS auth_login_attempts (
                    attempt_key TEXT PRIMARY KEY,
                    failures INTEGER NOT NULL DEFAULT 0,
                    last_failure TIMESTAMPTZ NOT NULL
                        DEFAULT NOW()
                )
            """)


def find_session(token: str | None):
    if not token or len(token) > 200:
        return None

    hashed = token_digest(token)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    u.id,
                    u.username

                FROM auth_sessions s

                JOIN auth_users u
                    ON u.id = s.user_id

                WHERE s.token_hash = %s
                  AND s.expires_at > NOW()
                  AND u.is_active = TRUE
            """, (hashed,))

            return cur.fetchone()


class LoginPayload(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=50
    )

    password: str = Field(
        min_length=1,
        max_length=512
    )


def login_attempt_key(
    request: Request,
    username: str
) -> str:
    client_ip = (
        request.client.host
        if request.client
        else "unknown"
    )

    return token_digest(
        f"{client_ip}:{username}"
    )


def is_rate_limited(key: str) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT failures
                FROM auth_login_attempts
                WHERE attempt_key = %s
                  AND last_failure >
                      NOW() - INTERVAL '15 minutes'
            """, (key,))

            record = cur.fetchone()

    return bool(
        record and record["failures"] >= LOGIN_LIMIT
    )


def record_failed_login(key: str):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO auth_login_attempts (
                    attempt_key,
                    failures,
                    last_failure
                )
                VALUES (%s, 1, NOW())

                ON CONFLICT (attempt_key)
                DO UPDATE SET
                    failures = CASE
                        WHEN auth_login_attempts.last_failure <
                            NOW() - INTERVAL '15 minutes'
                        THEN 1
                        ELSE auth_login_attempts.failures + 1
                    END,
                    last_failure = NOW()
            """, (key,))


def install_authentication(app):

    # ======================================
    # PROTECT ALL API ENDPOINTS
    # ======================================

    @app.middleware("http")
    async def authentication_middleware(
        request: Request,
        call_next
    ):
        path = request.url.path
        method = request.method.upper()

        if path.startswith("/api/"):

            if method in {"POST", "PUT", "PATCH", "DELETE"}:

                origin = request.headers.get("origin")

                if origin and origin not in ALLOWED_ORIGINS:
                    return JSONResponse(
                        {"detail": "Origin not allowed."},
                        status_code=403
                    )

                fetch_site = request.headers.get(
                    "sec-fetch-site"
                )

                if fetch_site and fetch_site not in {
                    "same-origin",
                    "none"
                }:
                    return JSONResponse(
                        {"detail": "Cross-site request blocked."},
                        status_code=403
                    )

                content_type = request.headers.get(
                    "content-type", ""
                ).lower()

                if not content_type.startswith(
                    "application/json"
                ):
                    return JSONResponse(
                        {"detail": "JSON requests required."},
                        status_code=415
                    )

            public_paths = {
                "/api/health",
                "/api/auth/login",
                "/api/auth/setup/status",
                "/api/auth/setup/create",
            }

            if (
                path not in public_paths
                and method != "OPTIONS"
            ):
                token = request.cookies.get(COOKIE_NAME)

                try:
                    user = find_session(token)
                except psycopg.Error:
                    return JSONResponse(
                        {"detail": "Database unavailable."},
                        status_code=503
                    )

                if not user:
                    return JSONResponse(
                        {"detail": "Authentication required."},
                        status_code=401
                    )

                request.state.auth_user = user

        response = await call_next(request)

        if path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["Referrer-Policy"] = "no-referrer"

        return response

    # ======================================
    # LOGIN
    # ======================================

    @app.post("/api/auth/login")
    def login(
        data: LoginPayload,
        request: Request,
        response: Response
    ):
        username = data.username.strip().lower()

        if not re.fullmatch(
            r"[a-z0-9_.-]{3,50}",
            username
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password."
            )

        attempt_key = login_attempt_key(
            request,
            username
        )

        try:
            if is_rate_limited(attempt_key):
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "Too many login attempts. "
                        "Try again in 15 minutes."
                    )
                )

            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id, username, password_hash
                        FROM auth_users
                        WHERE LOWER(username) = %s
                        AND is_active = TRUE
                    """, (username,))

                    user = cur.fetchone()

            stored_hash = (
                user["password_hash"]
                if user
                else DUMMY_HASH
            )

            valid = check_password(
                data.password,
                stored_hash
            )

            if not user or not valid:
                record_failed_login(attempt_key)

                raise HTTPException(
                    status_code=401,
                    detail="Invalid username or password."
                )

            token = secrets.token_urlsafe(48)

            expires = (
                datetime.now(timezone.utc)
                + timedelta(hours=SESSION_HOURS)
            )

            with get_connection() as conn:
                with conn.cursor() as cur:

                    cur.execute("""
                        DELETE FROM auth_sessions
                        WHERE expires_at <= NOW()
                    """)

                    cur.execute("""
                        DELETE FROM auth_login_attempts
                        WHERE attempt_key = %s
                    """, (attempt_key,))

                    cur.execute("""
                        INSERT INTO auth_sessions (
                            token_hash,
                            user_id,
                            expires_at
                        )
                        VALUES (%s, %s, %s)
                    """, (
                        token_digest(token),
                        user["id"],
                        expires
                    ))

            secure_cookie = os.getenv(
                "AUTH_COOKIE_SECURE", "false"
            ).lower() in {
                "true",
                "1",
                "yes"
            }

            response.set_cookie(
                key=COOKIE_NAME,
                value=token,
                httponly=True,
                secure=secure_cookie,
                samesite="strict",
                max_age=SESSION_HOURS * 3600,
                path="/api"
            )

            return {
                "authenticated": True,
                "username": user["username"]
            }

        except psycopg.Error as exc:
            raise HTTPException(
                status_code=503,
                detail="Database unavailable."
            ) from exc

    # ======================================
    # CURRENT SESSION
    # ======================================

    @app.get("/api/auth/me")
    def current_user(request: Request):
        user = request.state.auth_user

        return {
            "authenticated": True,
            "username": user["username"]
        }

    # ======================================
    # LOGOUT
    # ======================================

    @app.post("/api/auth/logout")
    def logout(
        request: Request,
        response: Response
    ):
        token = request.cookies.get(COOKIE_NAME)

        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        DELETE FROM auth_sessions
                        WHERE token_hash = %s
                    """, (
                        token_digest(token or ""),
                    ))

        except psycopg.Error as exc:
            raise HTTPException(
                status_code=503,
                detail="Could not complete logout."
            ) from exc

        response.delete_cookie(
            key=COOKIE_NAME,
            path="/api"
        )

        return {
            "success": True,
            "message": "Logged out."
        }
