
from datetime import date
from typing import Literal
from auth_security import install_authentication

import first_run
import psycopg
import requests

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db_access import (
    get_connection,
    update_carrier,
    save_authority_review
)

from carrier_search import find_new_carriers


app = FastAPI(
    title="Silvanne Carrier Finder API",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"]
)


STAGES = Literal[
    "Not contacted",
    "Contacted",
    "Replied",
    "Interested",
    "Follow-up",
    "Client"
]

STATUSES = Literal[
    "Not verified",
    "Needs investigation",
    "Property authority confirmed",
    "Not authorized",
    "Out of service"
]

STATES = Literal["TX", "GA", "FL", "NC", "OH", "PA"]


class OutreachUpdate(BaseModel):
    stage: STAGES
    contacted_today: bool = False
    next_follow_up: date | None = None
    notes: str = Field(default="", max_length=10000)


class VerificationUpdate(BaseModel):
    status: STATUSES
    source: str = ""
    notes: str = ""


class SearchRequest(BaseModel):
    state: STATES = "TX"
    target: Literal[10, 20, 50] = 20


CARRIER_QUERY = """
SELECT
    usdot,
    COALESCE(company, '') AS company,
    COALESCE(state, '') AS state,
    power_units,
    COALESCE(phone, '') AS phone,
    COALESCE(email, '') AS email,
    COALESCE(classification, '') AS classification,
    COALESCE(
        authority_verification, 'Not verified'
    ) AS authority_verification,
    COALESCE(equipment, '') AS equipment,
    COALESCE(
        outreach_stage, 'Not contacted'
    ) AS outreach_stage,
    TO_CHAR(
        last_contacted, 'YYYY-MM-DD'
    ) AS last_contacted,
    TO_CHAR(
        next_follow_up, 'YYYY-MM-DD'
    ) AS next_follow_up,
    COALESCE(notes, '') AS notes,
    COALESCE(
        verification_source, ''
    ) AS verification_source,
    COALESCE(
        verification_notes, ''
    ) AS verification_notes,
    TO_CHAR(
        verification_reviewed_on, 'YYYY-MM-DD'
    ) AS verification_reviewed_on
FROM carriers
"""


def database_error(error):
    raise HTTPException(
        status_code=503,
        detail="Database operation failed. Check backend terminal."
    ) from error


@app.get("/api/health")
def health():
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()

        return {
            "status": "ok",
            "database": "connected"
        }

    except psycopg.Error as error:
        database_error(error)


@app.get("/api/stats")
def get_stats():
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:

                cursor.execute("""
                    SELECT
                        COUNT(*)::int AS total,

                        COUNT(*) FILTER (
                            WHERE authority_verification IN (
                                'Property authority confirmed',
                                'Confirmed manually'
                            )
                        )::int AS verified,

                        COUNT(*) FILTER (
                            WHERE outreach_stage = 'Interested'
                        )::int AS interested,

                        COUNT(*) FILTER (
                            WHERE outreach_stage = 'Client'
                        )::int AS clients,

                        COUNT(*) FILTER (
                            WHERE next_follow_up <= CURRENT_DATE
                            AND COALESCE(outreach_stage, '') != 'Client'
                        )::int AS followups_due,

                        COUNT(*) FILTER (
                            WHERE authority_verification IS NULL
                            OR authority_verification IN (
                                '',
                                'Not verified',
                                'Pending',
                                'Needs investigation'
                            )
                        )::int AS pending_verification

                    FROM carriers
                """)

                totals = cursor.fetchone()

                cursor.execute("""
                    SELECT
                        COALESCE(
                            NULLIF(outreach_stage, ''),
                            'Not contacted'
                        ) AS stage,
                        COUNT(*)::int AS total
                    FROM carriers
                    GROUP BY 1
                    ORDER BY 1
                """)

                pipeline = cursor.fetchall()

        return {
            "totals": dict(totals),
            "pipeline": list(pipeline)
        }

    except psycopg.Error as error:
        database_error(error)


@app.get("/api/carriers")
def get_carriers(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str = "",
    state: str = "",
    stage: str = "",
    authority: str = "",
    verification_pending: bool = False
):
    conditions = []
    params = []

    if search.strip():
        conditions.append("""
            (
                company ILIKE %s
                OR usdot ILIKE %s
                OR phone ILIKE %s
            )
        """)

        term = f"%{search.strip()}%"
        params.extend([term, term, term])

    if state:
        conditions.append("state = %s")
        params.append(state.upper())

    if stage:
        conditions.append("outreach_stage = %s")
        params.append(stage)

    if authority:
        conditions.append(
            "authority_verification = %s"
        )
        params.append(authority)

    if verification_pending:
        conditions.append("""
            (
                authority_verification IS NULL
                OR authority_verification IN (
                    '', 'Not verified',
                    'Pending', 'Needs investigation'
                )
            )
        """)

    where_clause = ""

    if conditions:
        where_clause = " WHERE " + " AND ".join(conditions)

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:

                cursor.execute(
                    "SELECT COUNT(*)::int AS total FROM carriers"
                    + where_clause,
                    params
                )

                total = cursor.fetchone()["total"]

                cursor.execute(
                    CARRIER_QUERY
                    + where_clause
                    + " ORDER BY company ASC, usdot ASC "
                    + "LIMIT %s OFFSET %s",
                    [
                        *params,
                        page_size,
                        (page - 1) * page_size
                    ]
                )

                carriers = cursor.fetchall()

        return {
            "items": list(carriers),
            "total": total,
            "page": page,
            "page_size": page_size
        }

    except psycopg.Error as error:
        database_error(error)


@app.get("/api/carriers/{usdot}")
def get_one_carrier(usdot: str):
    if not usdot.isdigit():
        raise HTTPException(
            status_code=400,
            detail="Invalid USDOT number"
        )

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    CARRIER_QUERY + " WHERE usdot = %s",
                    (usdot,)
                )
                carrier = cursor.fetchone()

        if carrier is None:
            raise HTTPException(
                status_code=404,
                detail="Carrier not found"
            )

        return carrier

    except psycopg.Error as error:
        database_error(error)


@app.patch("/api/carriers/{usdot}/outreach")
def save_outreach(usdot: str, data: OutreachUpdate):
    try:
        update_carrier(
            usdot=usdot,
            stage=data.stage,
            contacted_today=data.contacted_today,
            follow_up=(
                data.next_follow_up.isoformat()
                if data.next_follow_up
                else ""
            ),
            notes=data.notes
        )

        return {"success": True}

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except psycopg.Error as error:
        database_error(error)


@app.patch("/api/carriers/{usdot}/verification")
def save_verification(usdot: str, data: VerificationUpdate):
    try:
        save_authority_review(
            usdot=usdot,
            status=data.status,
            source=data.source,
            notes=data.notes
        )

        return {"success": True}

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except psycopg.Error as error:
        database_error(error)


@app.get("/api/followups")
def get_followups(
    kind: Literal["due", "upcoming"] = "due"
):
    operator = "<=" if kind == "due" else ">"

    query = (
        CARRIER_QUERY
        + " WHERE next_follow_up IS NOT NULL "
        + f"AND next_follow_up {operator} CURRENT_DATE "
        + "AND COALESCE(outreach_stage, '') != 'Client' "
        + "ORDER BY next_follow_up ASC LIMIT 500"
    )

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()

        return {"items": list(results)}

    except psycopg.Error as error:
        database_error(error)


@app.post("/api/discover")
def discover_carriers(data: SearchRequest):
    try:
        added, scanned = find_new_carriers(
            state=data.state,
            target=data.target
        )

        return {
            "added": added,
            "scanned": scanned,
            "state": data.state
        }

    except requests.RequestException as error:
        raise HTTPException(
            status_code=502,
            detail="Unable to reach FMCSA API"
        ) from error

    except psycopg.Error as error:
        database_error(error)


# ==========================================
# OUTREACH HISTORY
# ==========================================

class ActivityCreate(BaseModel):
    channel: Literal[
        "Phone", "Email", "LinkedIn",
        "Facebook", "Other"
    ]

    outcome: Literal[
        "No answer",
        "Message sent",
        "Reply received",
        "Interested",
        "Follow-up requested",
        "Not interested",
        "Other"
    ]

    notes: str = Field(default="", max_length=5000)
    next_follow_up: date | None = None
    stage_after: STAGES | None = None


@app.get("/api/carriers/{usdot}/activities")
def get_activities(usdot: str):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT
                        id,
                        usdot,
                        channel,
                        outcome,
                        notes,
                        next_follow_up,
                        stage_after,
                        created_at
                    FROM outreach_activities
                    WHERE usdot = %s
                    ORDER BY created_at DESC, id DESC
                    LIMIT 100
                """, (usdot,))

                records = cursor.fetchall()

        return {"items": list(records)}

    except psycopg.Error as error:
        database_error(error)


@app.post("/api/carriers/{usdot}/activities")
def add_activity(usdot: str, data: ActivityCreate):

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:

                # Lock carrier row while updating
                cursor.execute(
                    "SELECT usdot FROM carriers "
                    "WHERE usdot = %s FOR UPDATE",
                    (usdot,)
                )

                if cursor.fetchone() is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Carrier not found."
                    )

                # Preserve every communication event
                cursor.execute("""
                    INSERT INTO outreach_activities (
                        usdot,
                        channel,
                        outcome,
                        notes,
                        next_follow_up,
                        stage_after
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    usdot,
                    data.channel,
                    data.outcome,
                    data.notes,
                    data.next_follow_up,
                    data.stage_after
                ))

                activity_id = cursor.fetchone()["id"]

                # Update the carrier's latest contact details
                cursor.execute("""
                    UPDATE carriers
                    SET
                        last_contacted = CURRENT_DATE,
                        next_follow_up = COALESCE(
                            %s, next_follow_up
                        ),
                        outreach_stage = COALESCE(
                            %s, outreach_stage
                        )
                    WHERE usdot = %s
                """, (
                    data.next_follow_up,
                    data.stage_after,
                    usdot
                ))

        return {
            "success": True,
            "activity_id": activity_id
        }

    except psycopg.Error as error:
        database_error(error)

# ==========================================
# ACTIVE CLIENTS
# ==========================================

class ActiveClientPayload(BaseModel):
    usdot: str = Field(
        min_length=1,
        max_length=20,
        pattern=r"^\d+$"
    )

    contact_name: str = Field(default="", max_length=150)
    contact_phone: str = Field(default="", max_length=50)
    contact_email: str = Field(default="", max_length=254)

    equipment: str = Field(default="", max_length=150)
    truck_count: int = Field(default=1, ge=1, le=100000)

    start_date: date

    dispatch_fee_percent: float | None = Field(
        default=None,
        ge=0,
        le=100
    )

    preferred_lanes: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=5000)

    agreement_signed: bool = False


@app.get("/api/active-clients")
def list_active_clients():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT
                        a.usdot,
                        c.company,
                        c.state,
                        COALESCE(
                            c.authority_verification,
                            'Not verified'
                        ) AS authority_verification,

                        a.contact_name,
                        a.contact_phone,
                        a.contact_email,
                        a.equipment,
                        a.truck_count,

                        TO_CHAR(
                            a.start_date,
                            'YYYY-MM-DD'
                        ) AS start_date,

                        a.dispatch_fee_percent::float
                            AS dispatch_fee_percent,

                        a.preferred_lanes,
                        a.notes,
                        a.agreement_signed

                    FROM active_clients a

                    JOIN carriers c
                        ON c.usdot = a.usdot

                    WHERE a.archived_at IS NULL

                    ORDER BY
                        a.start_date DESC,
                        c.company ASC
                """)

                clients = cur.fetchall()

        return {
            "items": list(clients),
            "total": len(clients)
        }

    except psycopg.Error as exc:
        db_error(exc)


@app.post("/api/active-clients")
def save_active_client(data: ActiveClientPayload):

    if not data.agreement_signed:
        raise HTTPException(
            status_code=422,
            detail=(
                "A signed dispatch agreement must be "
                "confirmed before activating a client."
            )
        )

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:

                cur.execute("""
                    SELECT usdot
                    FROM carriers
                    WHERE usdot = %s
                    FOR UPDATE
                """, (data.usdot,))

                if cur.fetchone() is None:
                    raise HTTPException(
                        status_code=404,
                        detail=(
                            "Carrier not found. Add the carrier "
                            "to Carrier Leads first."
                        )
                    )

                cur.execute("""
                    INSERT INTO active_clients (
                        usdot,
                        contact_name,
                        contact_phone,
                        contact_email,
                        equipment,
                        truck_count,
                        start_date,
                        dispatch_fee_percent,
                        preferred_lanes,
                        notes,
                        agreement_signed
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s
                    )

                    ON CONFLICT (usdot)
                    DO UPDATE SET
                        contact_name = EXCLUDED.contact_name,
                        contact_phone = EXCLUDED.contact_phone,
                        contact_email = EXCLUDED.contact_email,
                        equipment = EXCLUDED.equipment,
                        truck_count = EXCLUDED.truck_count,
                        start_date = EXCLUDED.start_date,
                        dispatch_fee_percent =
                            EXCLUDED.dispatch_fee_percent,
                        preferred_lanes = EXCLUDED.preferred_lanes,
                        notes = EXCLUDED.notes,
                        agreement_signed = EXCLUDED.agreement_signed,
                        archived_at = NULL,
                        updated_at = NOW()
                """, (
                    data.usdot,
                    data.contact_name.strip(),
                    data.contact_phone.strip(),
                    data.contact_email.strip(),
                    data.equipment.strip(),
                    data.truck_count,
                    data.start_date,
                    data.dispatch_fee_percent,
                    data.preferred_lanes.strip(),
                    data.notes.strip(),
                    data.agreement_signed
                ))

                # Also reflect the relationship in outreach.
                cur.execute("""
                    UPDATE carriers
                    SET outreach_stage = 'Client'
                    WHERE usdot = %s
                """, (data.usdot,))

        return {
            "success": True,
            "message": "Active client saved successfully."
        }

    except psycopg.Error as exc:
        db_error(exc)


@app.post("/api/active-clients/{usdot}/archive")
def archive_active_client(usdot: str):

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:

                cur.execute("""
                    UPDATE active_clients
                    SET
                        archived_at = NOW(),
                        updated_at = NOW()

                    WHERE usdot = %s
                      AND archived_at IS NULL

                    RETURNING usdot
                """, (usdot,))

                archived = cur.fetchone()

        if archived is None:
            raise HTTPException(
                status_code=404,
                detail="Active client not found."
            )

        return {
            "success": True,
            "message": "Client archived."
        }

    except psycopg.Error as exc:
        db_error(exc)

install_authentication(app)




from pathlib import Path
from fastapi.staticfiles import StaticFiles
from first_run import install_first_run

install_first_run(app)

FRONTEND_DIST = Path(__file__).resolve().parent / "frontend" / "dist"

if FRONTEND_DIST.is_dir():

    app.mount(
        "/",
        StaticFiles(directory=str(FRONTEND_DIST), html=True),
        name="lanecove-frontend"
    )

