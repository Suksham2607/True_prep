"""
One-off CLI to change a user's role.

There's no admin UI yet for managing roles (that's its own future
milestone - the SRS's "Rule Configuration UI" territory), so promoting
someone to coach/institute_admin/researcher happens here instead, run by
hand in the Codespace terminal.

Usage (from the backend/ directory, with the venv active):

    python -m scripts.set_role someone@example.com coach

Valid roles: candidate, coach, institute_admin, researcher
"""
import sys

from app.database import SessionLocal
from app.models.users import User, VALID_ROLES


def main():
    if len(sys.argv) != 3:
        print("Usage: python -m scripts.set_role <email> <role>")
        print(f"Valid roles: {', '.join(VALID_ROLES)}")
        sys.exit(1)

    email, role = sys.argv[1], sys.argv[2]

    if role not in VALID_ROLES:
        print(f"'{role}' isn't a valid role. Valid roles: {', '.join(VALID_ROLES)}")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"No user found with email {email}")
            sys.exit(1)

        old_role = user.role
        user.role = role
        db.commit()
        print(f"Updated {email}: {old_role} -> {role}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
