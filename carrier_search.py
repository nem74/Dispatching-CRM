
import requests
from db_access import get_connection
from public_email_search import normalize_email

API_URL = "https://data.transportation.gov/resource/az4n-8mr2.json"


def find_new_carriers(state="TX", target=20):
    page_size = 200
    max_pages = 10
    scanned = 0
    new_carriers = []

    # Get USDOT numbers already stored in PostgreSQL
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT usdot FROM carriers")
            known = {
                row["usdot"] for row in cursor.fetchall()
            }

    # Search FMCSA records page by page
    for page in range(max_pages):
        params = {
            "$where": (
                "status_code = 'A' "
                "AND carrier_operation = 'A' "
                f"AND phy_state = '{state}'"
            ),
            "$order": "dot_number DESC",
            "$limit": page_size,
            "$offset": page * page_size
        }

        response = requests.get(
            API_URL, params=params, timeout=30
        )
        response.raise_for_status()

        carriers = response.json()

        if not carriers:
            break

        scanned += len(carriers)

        for carrier in carriers:
            try:
                units = int(carrier.get("power_units") or 0)
            except (ValueError, TypeError):
                continue

            if not 1 <= units <= 5:
                continue

            classification = carrier.get("classdef") or ""

            categories = {
                item.strip()
                for item in classification.upper().split(";")
            }

            if "AUTHORIZED FOR HIRE" not in categories:
                continue

            usdot = str(
                carrier.get("dot_number") or ""
            ).strip()

            if not usdot or usdot in known:
                continue

            new_carriers.append((
                usdot,
                carrier.get("legal_name") or "Unknown",
                carrier.get("phy_state") or "",
                units,
                carrier.get("phone") or "",
                classification,
                normalize_email(carrier.get("email_address") or "")
            ))

            known.add(usdot)

            if len(new_carriers) >= target:
                break

        if len(new_carriers) >= target:
            break

        if len(carriers) < page_size:
            break

    # Save new carriers to PostgreSQL
    inserted = 0

    with get_connection() as conn:
        with conn.cursor() as cursor:

            for carrier in new_carriers:
                cursor.execute("""
                    INSERT INTO carriers (
                        usdot, company, state,
                        power_units, phone, classification, email,
                        authority_verification, outreach_stage
                    )
                    VALUES (
                        %s, %s, %s,
                        %s, %s, %s, %s,
                        'Pending', 'Not contacted'
                    )
                    ON CONFLICT (usdot) DO NOTHING
                """, carrier)

                inserted += cursor.rowcount

    return inserted, scanned


def refresh_missing_fmcsa_emails(limit=500):
    """Fill blank emails for existing carriers from FMCSA, max 500 per call."""
    if not 1 <= limit <= 500:
        raise ValueError("limit must be between 1 and 500")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT usdot FROM carriers
                WHERE email IS NULL OR BTRIM(email) = ''
                ORDER BY usdot DESC
                LIMIT %s
            """, (limit,))
            dot_numbers = [str(row["usdot"]) for row in cur.fetchall()]

    updated = 0
    for start in range(0, len(dot_numbers), 25):
        chunk = [dot for dot in dot_numbers[start:start + 25] if dot.isdigit()]
        if not chunk:
            continue
        where = "dot_number IN (" + ",".join(f"'{dot}'" for dot in chunk) + ")"
        response = requests.get(
            API_URL,
            params={"$select": "dot_number,email_address", "$where": where, "$limit": len(chunk)},
            timeout=30,
        )
        response.raise_for_status()
        records = response.json()
        with get_connection() as conn:
            with conn.cursor() as cur:
                for record in records:
                    dot = str(record.get("dot_number") or "")
                    email = normalize_email(record.get("email_address") or "")
                    if dot not in chunk or not email:
                        continue
                    cur.execute("""
                        UPDATE carriers SET email = %s
                        WHERE usdot = %s
                          AND (email IS NULL OR BTRIM(email) = '')
                    """, (email, dot))
                    updated += cur.rowcount
    return {"checked": len(dot_numbers), "updated": updated}
