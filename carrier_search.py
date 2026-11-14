
import requests
from db_access import get_connection

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
                classification
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
                        power_units, phone, classification,
                        authority_verification, outreach_stage
                    )
                    VALUES (
                        %s, %s, %s,
                        %s, %s, %s,
                        'Pending', 'Not contacted'
                    )
                    ON CONFLICT (usdot) DO NOTHING
                """, carrier)

                inserted += cursor.rowcount

    return inserted, scanned
