
import os
from pathlib import Path
from datetime import date

import pandas as pd
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv


# --------------------------------
# DATABASE CONFIGURATION
# --------------------------------

BASE_DIR = Path(__file__).resolve().parent

# Load credentials from .env
load_dotenv(BASE_DIR / ".env")


# --------------------------------
# 1. CONNECT TO POSTGRESQL
# --------------------------------

def get_connection():

    return psycopg.connect(
        host=os.environ["DB_HOST"],
        port=os.environ["DB_PORT"],
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        row_factory=dict_row
    )


# --------------------------------
# 2. LOAD CARRIERS
# --------------------------------

def load_carriers():

    query = """
        SELECT
            COALESCE(company, '') AS "Company",

            usdot AS "USDOT",

            COALESCE(state, '') AS "State",

            COALESCE(
                power_units::text, ''
            ) AS "Power Units",

            COALESCE(phone, '') AS "Phone",

            COALESCE(email, '') AS "Email",

            COALESCE(
                classification, ''
            ) AS "Classification",

            COALESCE(
                authority_verification,
                'Not verified'
            ) AS "Authority Verification",

            COALESCE(
                equipment, ''
            ) AS "Equipment",

            COALESCE(
                outreach_stage,
                'Not contacted'
            ) AS "Outreach Stage",

            COALESCE(
                TO_CHAR(
                    last_contacted,
                    'YYYY-MM-DD'
                ),
                ''
            ) AS "Last Contacted",

            COALESCE(
                TO_CHAR(
                    next_follow_up,
                    'YYYY-MM-DD'
                ),
                ''
            ) AS "Next Follow-up",

            COALESCE(
                notes, ''
            ) AS "Notes",

            COALESCE(
                verification_source, ''
            ) AS "Verification Source",

            COALESCE(
                verification_notes, ''
            ) AS "Verification Notes",

            COALESCE(
                TO_CHAR(
                    verification_reviewed_on,
                    'YYYY-MM-DD'
                ),
                ''
            ) AS "Reviewed On"

        FROM carriers

        ORDER BY company ASC
    """

    with get_connection() as connection:

        with connection.cursor() as cursor:

            cursor.execute(query)

            records = cursor.fetchall()

    return pd.DataFrame(records)


# --------------------------------
# 3. UPDATE CARRIER OUTREACH
# --------------------------------

def update_carrier(
    usdot,
    stage,
    contacted_today,
    follow_up,
    notes
):

    # Validate and convert follow-up date
    follow_up_date = (
        date.fromisoformat(follow_up.strip())
        if follow_up and follow_up.strip()
        else None
    )

    query = """
        UPDATE carriers

        SET
            outreach_stage = %s,

            next_follow_up = %s,

            notes = %s,

            last_contacted = CASE
                WHEN %s THEN %s
                ELSE last_contacted
            END

        WHERE usdot = %s

        RETURNING usdot
    """

    with get_connection() as connection:

        with connection.cursor() as cursor:

            cursor.execute(
                query,
                (
                    stage,
                    follow_up_date,
                    notes,
                    contacted_today,
                    date.today(),
                    usdot
                )
            )

            result = cursor.fetchone()

            if result is None:
                raise ValueError(
                    "Carrier not found in database."
                )

    return True


# --------------------------------
# 4. SAVE AUTHORITY VERIFICATION
# --------------------------------

def save_authority_review(
    usdot,
    status,
    source,
    notes
):

    # Allowed verification statuses
    allowed_statuses = {
        "Not verified",
        "Needs investigation",
        "Property authority confirmed",
        "Not authorized",
        "Out of service"
    }

    if status not in allowed_statuses:
        raise ValueError(
            "Invalid verification status."
        )

    # Clean input values
    source = (source or "").strip()
    notes = (notes or "").strip()

    # These statuses require evidence
    final_statuses = {
        "Property authority confirmed",
        "Not authorized",
        "Out of service"
    }

    if status in final_statuses:

        if not source.startswith("https://"):
            raise ValueError(
                "Provide an official HTTPS "
                "verification source URL."
            )

        if not notes:
            raise ValueError(
                "Enter notes explaining "
                "what was verified."
            )

    query = """
        UPDATE carriers

        SET
            authority_verification = %s,

            verification_source = %s,

            verification_notes = %s,

            verification_reviewed_on = CURRENT_DATE

        WHERE usdot = %s

        RETURNING usdot
    """

    with get_connection() as connection:

        with connection.cursor() as cursor:

            cursor.execute(
                query,
                (
                    status,
                    source,
                    notes,
                    usdot
                )
            )

            result = cursor.fetchone()

            if result is None:
                raise ValueError(
                    "Carrier not found in database."
                )

    return True
