from datetime import datetime, timezone

from pydantic import BaseModel, field_serializer


class UTCTimestampModel(BaseModel):
    """
    Base class for any response schema that includes a datetime field.

    Every timestamp in this app (created_at, started_at, ended_at,
    consent_given_at, calibrated_at, ...) is written as a UTC instant -
    either via the database's own `func.now()` or via
    `datetime.now(timezone.utc)` in application code. But SQLite and
    MySQL's DATETIME columns don't store a timezone, so whatever comes
    back out of the database is a *naive* datetime object with no tzinfo
    at all. Left alone, Pydantic serializes that as an ISO string with no
    offset (e.g. "2026-09-03T16:27:00") - and per the ECMAScript Date
    Time String Format, a browser's `new Date(...)` treats a date-time
    string with no offset as LOCAL time, not UTC. The practical effect:
    every timestamp in the app displayed exactly `value - UTC_offset`
    instead of the real local time - about 5.5 hours early for a
    browser set to India Standard Time, for example.

    Attaching UTC tzinfo here before serialization means the JSON that
    actually leaves the API always carries an explicit offset (e.g.
    "2026-09-03T16:27:00+00:00"). The frontend needs no changes for
    this - `new Date(...)` correctly parses an offset-bearing string as
    that UTC instant, and every existing `.toLocaleString()` /
    `.toLocaleDateString()` call already converts to whatever timezone
    the viewer's own browser is set to.
    """

    @field_serializer("*", when_used="json", check_fields=False)
    def _serialize_datetime_as_utc(self, value):
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
