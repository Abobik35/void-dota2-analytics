from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    opendota_base_url: str = "https://api.opendota.com/api"
    opendota_api_key: str | None = None
    database_url: str = "sqlite:///./void.db"
    # Папка собранного фронтенда для раздачи одним сервером (prod); в разработке не задана — пусто
    frontend_dist: str | None = None
    cors_origins: str = "http://localhost:5173"
    request_timeout_s: float = 15.0
    # Адрес сайта в браузере (для входа через Steam). При другом порте или домене поменяйте в .env
    public_url: str = "http://localhost:5173"
    secret_key: str | None = None
    session_days: int = 30


settings = Settings()
