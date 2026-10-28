from datetime import datetime
from sqlalchemy import DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from app.core.config import settings

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class CachedResponse(Base):
    """Сырой ответ внешнего источника. Хранится отдельно от вычисленных показателей."""
    __tablename__ = "cached_responses"
    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    payload: Mapped[str] = mapped_column(Text)
    fetched_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)


class User(Base):
    """Профиль, созданный при входе через Steam. Хранит только идентификаторы."""
    __tablename__ = "users"
    steam_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    account_id: Mapped[int] = mapped_column(Integer, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    last_login_at: Mapped[datetime] = mapped_column(DateTime)
