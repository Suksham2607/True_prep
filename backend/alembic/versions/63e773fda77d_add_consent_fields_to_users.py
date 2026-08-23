"""add consent fields to users

Revision ID: 63e773fda77d
Revises: fd062001f86a
Create Date: 2026-08-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '63e773fda77d'
down_revision: Union[str, Sequence[str], None] = 'fd062001f86a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('has_given_consent', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('consent_given_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'consent_given_at')
    op.drop_column('users', 'has_given_consent')
