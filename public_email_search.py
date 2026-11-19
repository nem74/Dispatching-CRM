"""Public business email discovery helpers for LaneCove.

FMCSA emails are read from the official Company Census dataset. Optional
web search returns suggestions with source links and NEVER saves them.
"""
import os
import re
from html import unescape
from urllib.parse import urlparse

import requests

EMAIL_RE = re.compile(r"(?i)(?<![A-Z0-9._%+\-])([A-Z0-9._%+\-]{1,64}@[A-Z0-9.\-]{1,189}\.[A-Z]{2,24})(?![A-Z0-9._%+\-])")
INVALID_ENDINGS = {"png", "jpg", "jpeg", "gif", "svg", "webp", "css", "js", "html", "pdf"}


def normalize_email(value):
    """Return a clean first email address or an empty string."""
    if not isinstance(value, str):
        return ""
    match = EMAIL_RE.search(unescape(value))
    if not match:
        return ""
    result = match.group(1).strip().lower()
    domain = result.rsplit("@", 1)[1]
    if len(result) > 254 or ".." in result or domain.startswith("-"):
        return ""
    if domain.rsplit(".", 1)[-1] in INVALID_ENDINGS:
        return ""
    return result


def find_public_email_candidates(company, usdot, state):
    """Search indexed public webpages, returning UNVERIFIED email candidates.

    Requires a user-provided BRAVE_SEARCH_API_KEY. This intentionally does not
    crawl arbitrary websites, bypass access controls, or guess email addresses.
    """
    key = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
    if not key:
        raise ValueError(
            "Online search needs a Brave Search API key. "
            "Add BRAVE_SEARCH_API_KEY to your private .env file. "
            "FMCSA email import works without this key."
        )

    queries = [
        f'"{company}" "{usdot}" email',
        f'"{company}" "{state}" trucking contact email',
    ]
    candidates = []
    seen = set()
    words = [
        w for w in re.findall(r"[a-z0-9]+", company.lower())
        if w not in {"llc", "inc", "corp", "co", "ltd", "the", "and"}
    ]
    for query in queries:
        response = requests.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers={"X-Subscription-Token": key, "Accept": "application/json"},
            params={"q": query, "count": 8, "country": "US", "search_lang": "en"},
            timeout=15,
        )
        response.raise_for_status()
        for entry in response.json().get("web", {}).get("results", []):
            link = entry.get("url", "")
            parsed = urlparse(link)
            if parsed.scheme != "https" or not parsed.hostname:
                continue
            # Only accept evidence from the named company's indexed result.
            title = unescape(entry.get("title") or "")
            description = unescape(entry.get("description") or "")
            excerpts = entry.get("extra_snippets") or []
            combined = " ".join([title, description, *excerpts])
            lower = combined.lower()
            company_match = bool(words) and sum(w in lower for w in words) >= min(2, len(words))
            if not company_match and str(usdot) not in combined:
                continue
            for match in EMAIL_RE.finditer(combined):
                email = normalize_email(match.group(1))
                if not email or email in seen:
                    continue
                seen.add(email)
                candidates.append({
                    "email": email,
                    "source_url": link,
                    "source_title": title[:160],
                    "verified": False,
                })
                if len(candidates) >= 8:
                    return candidates
    return candidates
