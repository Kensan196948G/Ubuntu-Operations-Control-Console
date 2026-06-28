from __future__ import annotations

import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Iterator

from sqlalchemy import Boolean, DateTime, Integer, String, Text, create_engine, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .settings import settings


def _normalize_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


engine = create_engine(_normalize_url(settings.database_url), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
db_available = False


class Base(DeclarativeBase):
    pass


class OperationHistory(Base):
    __tablename__ = "operation_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[str] = mapped_column(String(128), nullable=False)
    target_name: Mapped[str] = mapped_column(String(256), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_name: Mapped[str] = mapped_column(String(256), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    result: Mapped[str] = mapped_column(String(32), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ManagedTarget(Base):
    __tablename__ = "managed_targets"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    type: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    display_name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


def init_db() -> bool:
    global db_available
    try:
        Base.metadata.create_all(bind=engine)
        db_available = True
    except SQLAlchemyError:
        db_available = False
    return db_available


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def now_utc() -> datetime:
    return datetime.now(UTC)


def create_operation(target_type: str, target_id: str, target_name: str, action: str) -> str:
    operation_id = str(uuid.uuid4())
    try:
        with session_scope() as session:
            session.add(
                OperationHistory(
                    id=operation_id,
                    target_type=target_type,
                    target_id=target_id,
                    target_name=target_name,
                    action=action,
                    status="running",
                    started_at=now_utc(),
                )
            )
    except SQLAlchemyError:
        pass
    return operation_id


def finish_operation(operation_id: str, status: str, duration_ms: int, error_message: str | None) -> None:
    try:
        with session_scope() as session:
            operation = session.get(OperationHistory, operation_id)
            if operation:
                operation.status = status
                operation.finished_at = now_utc()
                operation.duration_ms = duration_ms
                operation.error_message = error_message
    except SQLAlchemyError:
        pass


def write_audit(
    event_type: str,
    target_type: str,
    target_name: str,
    action: str,
    result: str,
    ip_address: str | None,
    user_agent: str | None,
    error_message: str | None = None,
) -> None:
    try:
        with session_scope() as session:
            session.add(
                AuditLog(
                    id=str(uuid.uuid4()),
                    event_type=event_type,
                    target_type=target_type,
                    target_name=target_name,
                    action=action,
                    result=result,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    error_message=error_message,
                    created_at=now_utc(),
                )
            )
    except SQLAlchemyError:
        pass


def list_operations(limit: int = 100) -> list[OperationHistory]:
    try:
        with session_scope() as session:
            return list(session.scalars(select(OperationHistory).order_by(OperationHistory.started_at.desc()).limit(limit)))
    except SQLAlchemyError:
        return []


def get_operation(operation_id: str) -> OperationHistory | None:
    try:
        with session_scope() as session:
            return session.get(OperationHistory, operation_id)
    except SQLAlchemyError:
        return None


def list_audit_logs(limit: int = 100) -> list[AuditLog]:
    try:
        with session_scope() as session:
            return list(session.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)))
    except SQLAlchemyError:
        return []

