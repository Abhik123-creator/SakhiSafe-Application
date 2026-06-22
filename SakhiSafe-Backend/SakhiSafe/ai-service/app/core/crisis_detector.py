SEXUAL_VIOLENCE_TERMS = (
    "rape",
    "raped",
    "sexually abuse",
    "sexual abuse",
    "sexual assault",
    "forced sex",
    "forced me",
    "molest",
    "marital rape",
    "strip",
    "undress",
    "naked",
    "nude",
)

PHYSICAL_VIOLENCE_TERMS = (
    "hit me",
    "beat me",
    "beats me",
    "slapped me",
    "attacked me",
    "hurt me",
    "beats me up",
)

BURN_INJURY_TERMS = (
    "cigarette",
    "burned",
    "burn",
    "bleeding",
    "injured",
)

WHAT_TO_DO_TERMS = (
    "what should i do",
    "what to do",
    "help me",
    "give me answer",
    "tell me what",
)

ESCAPE_TERMS = (
    "escape plan",
    "escape",
    "leave",
    "run away",
)

ABUSER_NOT_NEARBY_TERMS = (
    "not near me",
    "they are not near me",
    "he is not near me",
    "safe now",
    "not nearby",
)

ABUSER_NEARBY_TERMS = (
    "near me",
    "nearby",
    "he is here",
    "they are here",
    "in front of me",
    "outside my room",
)

CURRENT_DANGER_TERMS = (
    "trapped",
    "tied",
    "locked",
    "bleeding",
    "unsafe",
    "scared",
    "danger",
    "emergency",
)

REPEATED_ABUSE_TERMS = (
    "everyday",
    "every day",
    "daily",
    "again and again",
)


def detect_crisis_signals(text: str) -> dict:
    normalized = (text or "").lower()
    reported_rape = _contains_any(normalized, SEXUAL_VIOLENCE_TERMS)
    reported_physical_assault = _contains_any(normalized, PHYSICAL_VIOLENCE_TERMS)
    reported_burn = _contains_any(normalized, BURN_INJURY_TERMS)
    asks_what_to_do = _contains_any(normalized, WHAT_TO_DO_TERMS)
    asks_escape_plan = _contains_any(normalized, ESCAPE_TERMS)
    says_abuser_not_nearby = _contains_any(normalized, ABUSER_NOT_NEARBY_TERMS)
    says_abuser_nearby = not says_abuser_not_nearby and _contains_any(normalized, ABUSER_NEARBY_TERMS)
    current_danger = _contains_any(normalized, CURRENT_DANGER_TERMS)
    repeated_abuse = _contains_any(normalized, REPEATED_ABUSE_TERMS)

    is_crisis = any(
        (
            reported_rape,
            reported_physical_assault,
            reported_burn,
            asks_what_to_do,
            asks_escape_plan,
            says_abuser_not_nearby,
            says_abuser_nearby,
            current_danger,
        )
    )

    risk_level = "high"
    if (reported_rape and (reported_physical_assault or reported_burn)) or current_danger or says_abuser_nearby:
        risk_level = "critical"
    elif repeated_abuse and (reported_rape or reported_physical_assault or reported_burn):
        risk_level = "critical"

    return {
        "is_crisis": is_crisis,
        "reported_rape": reported_rape,
        "reported_physical_assault": reported_physical_assault,
        "reported_burn": reported_burn,
        "asks_what_to_do": asks_what_to_do,
        "asks_escape_plan": asks_escape_plan,
        "says_abuser_not_nearby": says_abuser_not_nearby,
        "says_abuser_nearby": says_abuser_nearby,
        "risk_level": risk_level,
    }


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)
