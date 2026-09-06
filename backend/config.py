import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _load_dotenv(path):
    """Carga mínima de variables de entorno desde un archivo .env.

    Se implementa a mano para evitar dependencias adicionales.
    No sobrescribe variables ya definidas en el sistema.
    """
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(BASE_DIR / ".env")


def _get_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Config:
    HOST = os.getenv("FLASK_HOST", "0.0.0.0")
    PORT = int(os.getenv("FLASK_PORT", "5000"))
    DEBUG = _get_bool("FLASK_DEBUG", True)

    # Base de datos: en desarrollo usamos SQLite (archivo local data.db).
    #
    # Para usar Supabase (PostgreSQL) basta con definir DATABASE_URL
    # (ej: en backend/.env). Si DATABASE_URL está definida, database.py
    # abre una conexión a PostgreSQL; si no, usa SQLite. De esta forma
    # los tests (SQLite) y la app en producción (Supabase) conviven.
    DATABASE_URL = os.getenv("DATABASE_URL") or ""
    DATABASE_PATH = os.getenv("DATABASE_PATH") or str(BASE_DIR / "data.db")
    DATABASE_SSL = os.getenv("DATABASE_SSL", "require")

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # Tokens de acceso (autenticación)
    # SECRET_KEY debe tener AL MENOS 32 bytes (PyJWT lo exige para HS256).
    # En producción usa una generada al azar (ver .env.example).
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-super-secret-key-iafam-2026-xxxx")
    TOKEN_TTL_HOURS = int(os.getenv("TOKEN_TTL_HOURS", "24"))

    # Validación
    MIN_PASSWORD_LENGTH = int(os.getenv("MIN_PASSWORD_LENGTH", "8"))

    # Semilla para crear un administrador inicial (opcional)
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@iafam.dev")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234")
