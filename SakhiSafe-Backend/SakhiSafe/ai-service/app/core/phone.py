import re


def normalize_phone(phone: str | None) -> str:
    value = (phone or "").strip()
    if not value:
        return ""

    has_plus = value.startswith("+")
    digits = re.sub(r"\D", "", value)
    if not digits:
        return value
    if has_plus:
        return f"+{digits}"
    if len(digits) >= 10:
        return f"+{digits}"
    return digits


def normalize_phone_for_api(phone: str | None) -> str:
    value = (phone or "").strip()
    digits = re.sub(r"\D", "", value)
    return digits or value


def phone_lookup_variants(phone: str | None) -> list[str]:
    normalized = normalize_phone(phone)
    api_normalized = normalize_phone_for_api(phone)
    original = (phone or "").strip()
    values = []
    for value in (api_normalized, normalized, normalized.removeprefix("+"), original):
        if value and value not in values:
            values.append(value)
    return values
