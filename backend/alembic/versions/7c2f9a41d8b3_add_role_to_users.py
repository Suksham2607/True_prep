"""add role to users

Revision ID: 7c2f9a41d8b3
Revises: 9a1c2f3b7d4e
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c2f9a41d8b3'
down_revision: Union[str, Sequence[str], None] = '9a1c2f3b7d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('role', sa.String(length=20), server_default='candidate', nullable=False))
    op.create_check_constraint(
        'ck_users_role',
        'users',
        "role IN ('candidate', 'coach', 'institute_admin', 'researcher')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_users_role', 'users', type_='check')
    op.drop_column('users', 'role')
