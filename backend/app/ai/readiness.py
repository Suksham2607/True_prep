"""
Milestone 7: the rule-based readiness engine. Takes one live session's
measured features and the user's calibrated baseline, and produces:
  - a 0-100 readiness score
  - one plain-language, number-backed feedback line per feature

Deliberately rule-based rather than ML-driven, matching the project's
stated philosophy (see faceMetrics.js's honesty note): every number here
traces back to a simple, inspectable formula, not a trained model. The
score answers one narrow question - "how close was this session to your
own calibrated normal?" - not a general judgment of performance,
confidence, or anxiety. A big deviation from baseline isn't automatically
bad; it's just different from how you usually are, which is worth
noticing and left for the person to interpret.
"""

FEATURE_META = {
    "eye_contact": {"label": "Eye Contact", "unit": "%"},
    "blink_rate": {"label": "Blink Rate", "unit": "/min"},
    "facial_engagement": {"label": "Facial Engagement", "unit": ""},
    "pitch_stability": {"label": "Pitch Stability", "unit": ""},
    "voice_energy": {"label": "Voice Energy", "unit": ""},
    "speaking_speed": {"label": "Speaking Speed", "unit": " wpm"},
    "pause_duration": {"label": "Pause Length", "unit": "s"},
    "filler_word_rate": {"label": "Filler Word Rate", "unit": "/min"},
}

# How far from baseline (in standard deviations) counts as "mild" vs
# "notable" - anything closer than MILD_Z_THRESHOLD is just "in range".
MILD_Z_THRESHOLD = 1.0
NOTABLE_Z_THRESHOLD = 2.0
# z-scores are clipped to this before scoring/messaging - beyond this,
# calling something "even more extreme" stops being informative.
MAX_Z = 4.0


def compute_z_score(value, mean, std):
    """
    How many standard deviations `value` is from the baseline mean.
    Returns None if there's nothing meaningful to compare against - a
    missing reading, or a baseline feature with zero recorded spread
    (can happen with a very short or unusually uniform calibration).
    """
    if value is None or mean is None or std is None:
        return None
    if std == 0:
        return None
    z = (value - mean) / std
    return max(-MAX_Z, min(MAX_Z, z))


def classify(z_score):
    """Turns a z-score into a severity band + direction word."""
    if z_score is None:
        return "unknown", None
    direction = "higher" if z_score > 0 else "lower" if z_score < 0 else "same"
    magnitude = abs(z_score)
    if magnitude < MILD_Z_THRESHOLD:
        return "in_range", direction
    if magnitude < NOTABLE_Z_THRESHOLD:
        return "mild", direction
    return "notable", direction


def feature_score(z_score):
    """
    Per-feature sub-score, 0-100: no deviation from baseline scores 100,
    scaling linearly down to 20 at the clipped max deviation (MAX_Z).
    A feature with no usable z-score contributes no score at all rather
    than being counted as 0 or 100 - handled by the caller.
    """
    if z_score is None:
        return None
    magnitude = min(abs(z_score), MAX_Z)
    return max(20.0, 100.0 - (magnitude / MAX_Z) * 80.0)


def format_value(feature_key, value):
    if value is None:
        return "n/a"
    unit = FEATURE_META[feature_key]["unit"]
    return f"{value:.1f}{unit}"


def build_message(feature_key, value, mean, severity, direction):
    """
    One plain-language, number-backed sentence per feature. Deliberately
    descriptive ("X was notably higher than your baseline") rather than
    diagnostic ("you are anxious") - same honesty stance as the rest of
    the project's feature extraction.
    """
    label = FEATURE_META[feature_key]["label"]

    if severity == "unknown":
        return f"{label}: not enough baseline data to compare this session against."

    value_str = format_value(feature_key, value)
    mean_str = format_value(feature_key, mean)

    if severity == "in_range":
        return f"{label} was in line with your baseline ({value_str} vs your usual {mean_str})."

    qualifier = "somewhat" if severity == "mild" else "notably"
    return (
        f"{label} was {qualifier} {direction} than your baseline "
        f"({value_str} vs your usual {mean_str})."
    )


def evaluate_session(session_values, baseline):
    """
    `session_values`: dict of the 8 raw feature readings from one live
    session (same keys as FEATURE_META - missing/None entries are
    treated as "couldn't measure this one"). `baseline`: the
    BaselineProfile row (or anything exposing matching `<feature>_mean`
    / `<feature>_std` attributes) to compare against.

    Returns {"overall_readiness_score": float | None, "feedback": [...]}
    - one feedback dict per feature, plus the combined score (the
    average of each feature's own 0-100 sub-score, over only the
    features that had enough data to compare - see feature_score).
    `overall_readiness_score` is None only if every single feature
    lacked enough data, which shouldn't happen in practice but is
    handled rather than silently reported as a misleading 0 or 100.
    """
    feedback = []
    sub_scores = []

    for feature_key in FEATURE_META:
        value = session_values.get(feature_key)
        mean = getattr(baseline, f"{feature_key}_mean", None)
        std = getattr(baseline, f"{feature_key}_std", None)

        z = compute_z_score(value, mean, std)
        severity, direction = classify(z)
        score = feature_score(z)
        if score is not None:
            sub_scores.append(score)

        feedback.append({
            "feature": feature_key,
            "label": FEATURE_META[feature_key]["label"],
            "value": value,
            "baseline_mean": mean,
            "baseline_std": std,
            "z_score": round(z, 2) if z is not None else None,
            "severity": severity,
            "message": build_message(feature_key, value, mean, severity, direction),
        })

    overall_score = round(sum(sub_scores) / len(sub_scores), 1) if sub_scores else None

    return {"overall_readiness_score": overall_score, "feedback": feedback}
