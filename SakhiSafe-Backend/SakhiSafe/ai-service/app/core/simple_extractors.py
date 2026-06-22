from datetime import date, timedelta
import re


def extract_relative_date(text: str) -> str | None:
    normalized_text = text.lower()
    today = date.today()

    if "yesterday" in normalized_text or "last night" in normalized_text:
        return (today - timedelta(days=1)).isoformat()

    if "today" in normalized_text:
        return today.isoformat()

    return None


def extract_location(text: str) -> str | None:
    normalized_text = text.lower()

    location_match = re.search(r"\blocation\b\s+(.+)$", normalized_text)
    if location_match:
        return _clean_location(location_match.group(1))

    at_match = re.search(r"\bat\b\s+(.+)$", normalized_text)
    if at_match:
        return _clean_location(at_match.group(1))

    return None


def _clean_location(value: str) -> str | None:
    value = re.sub(r"\b(today|yesterday|last night)\b", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip(" .,")
    return value or None
