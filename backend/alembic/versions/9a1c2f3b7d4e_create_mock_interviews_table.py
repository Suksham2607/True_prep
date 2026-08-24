"""create mock_interviews table

Revision ID: 9a1c2f3b7d4e
Revises: e0f56ae61b7b
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a1c2f3b7d4e'
down_revision: Union[str, Sequence[str], None] = 'e0f56ae61b7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Milestone 8: one row per LLM-driven mock interview. `transcript_json`
    holds the whole back-and-forth (interviewer questions + candidate
    answers) as a JSON-encoded list, matching the shape sent to Groq's
    chat API - see app/models/mock_interview.py for why this isn't a
    separate turns table.
    """
    op.create_table('mock_interviews',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('role', sa.String(length=120), nullable=True),
    sa.Column('status', sa.String(length=20), server_default='in_progress', nullable=False),
    sa.Column('transcript_json', sa.Text(), nullable=False),
    sa.Column('closing_message', sa.Text(), nullable=True),
    sa.Column('started_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('ended_at', sa.DateTime(), nullable=True),
    sa.CheckConstraint("status IN ('in_progress', 'completed')", name='ck_mock_interviews_status'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mock_interviews_id'), 'mock_interviews', ['id'], unique=False)
    op.create_index(op.f('ix_mock_interviews_user_id'), 'mock_interviews', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_mock_interviews_user_id'), table_name='mock_interviews')
    op.drop_index(op.f('ix_mock_interviews_id'), table_name='mock_interviews')
    op.drop_table('mock_interviews')
