"""Configuración de la conexión a la base de datos y creación de tablas.

IMPORTANTE PARA ENTENDER (Paulo):

La app puede usar DOS bases de datos según lo que definas en backend/.env:

  1) SQLite   (desarrollo, archivo local data.db)  →  cuando NO hay DATABASE_URL
  2) PostgreSQL / Supabase  (producción, servidor)  →  cuando SÍ hay DATABASE_URL

Este archivo es el ÚNICO puente: TODAS las consultas de la app pasan por
`get_connection()`. El resto de capas (models.py, routes.py) se escribe
igual para las dos. La magia está en la clase PostgresConnection: imita
la interfaz de sqlite3 (execute, fetchone, fetchall, lastrowid) y traduce
el "dialecto SQLite" de models.py al "dialecto PostgreSQL":

  SQLite                          PostgreSQL
  ------------------------------  ----------------------------------------
  ?  (placeholder)                %s  (placeholder)
  INSERT OR IGNORE INTO ...       INSERT INTO ... ON CONFLICT DO NOTHING
  datetime('now')                 now()
  cur.lastrowid                   RETURNING id  (psycopg nos lo devuelve)
  PRAGMA foreign_keys = ON        (no hace falta: Postgres siempre las cumple)

Así, models.py NO cambia un solo carácter al migrar de SQLite a Supabase.
"""
import re
import sqlite3
from pathlib import Path

from config import Config

# Esquemas: SQLite (dev) y PostgreSQL (Supabase/producción)
SCHEMA_PATH = Path(__file__).resolve().parent.parent / "database" / "schema.sql"
SCHEMA_POSTGRES_PATH = (
    Path(__file__).resolve().parent.parent / "database" / "schema_postgres.sql"
)

# Expresiones regulares para traducir el SQL de SQLite a PostgreSQL
_INSERT_RE = re.compile(r"^\s*INSERT\s+INTO\s+(\S+)", re.IGNORECASE)
_INSERT_OR_IGNORE_RE = re.compile(r"^\s*INSERT\s+OR\s+IGNORE\s+INTO", re.IGNORECASE)


# =====================================================================
# Fila "comodín": igual que sqlite3.Row (fila["nombre"] y fila[0])
# =====================================================================
class PgRow:
    """Resultado de una consulta en PostgreSQL con interfaz de sqlite3.Row.

    Permite acceder por NOMBRE de columna (fila["title"]) o por posición
    (fila[0]), y se convierte a diccionario con dict(fila).
    """
    __slots__ = ("_names", "_values")

    def __init__(self, names, values):
        self._names = tuple(names)
        self._values = tuple(values)

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return self._values[self._names.index(key)]

    def __iter__(self):
        return iter(self._values)

    def __len__(self):
        return len(self._values)

    def keys(self):
        return list(self._names)

    def get(self, key, default=None):
        try:
            return self[key]
        except (IndexError, ValueError):
            return default


def _pg_row_factory(cursor, values):
    names = [d.name for d in cursor.description]
    return PgRow(names, values)


# =====================================================================
# Cursor PostgreSQL: imita el cursor de sqlite3 (con .lastrowid)
# =====================================================================
class PgCursor:
    def __init__(self, cur, lastrowid=None):
        self._cur = cur
        self.lastrowid = lastrowid

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def close(self):
        self._cur.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


# =====================================================================
# Conexión PostgreSQL: imita la interfaz de sqlite3.Connection
# =====================================================================
class PostgresConnection:
    def __init__(self, conn):
        self._conn = conn

    # ---------------------------------------------------------------
    # Traducción SQLite -> PostgreSQL
    # ---------------------------------------------------------------
    @staticmethod
    def _translate(sql):
        # 1) datetime('now') -> now()
        sql = sql.replace("datetime('now')", "now()")

        # 2) INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
        if _INSERT_OR_IGNORE_RE.match(sql):
            sql = re.sub(_INSERT_OR_IGNORE_RE, "INSERT INTO", sql, count=1)
            sql = sql.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"

        # 3) INSERT normal -> añadir RETURNING id para obtener lastrowid
        #    (solo cuando la tabla tenga PK id; las tablas puente usan
        #    INSERT OR IGNORE, que ya no pasa por aquí)
        elif _INSERT_RE.match(sql) and " RETURNING " not in sql.upper():
            sql = sql.rstrip().rstrip(";") + " RETURNING id"

        # 4) placeholders ? -> %s
        sql = sql.replace("?", "%s")
        return sql

    # ---------------------------------------------------------------
    # API pública (la que usa models.py)
    # ---------------------------------------------------------------
    def execute(self, sql, params=()):
        translated = self._translate(sql)
        cur = self._conn.cursor(row_factory=_pg_row_factory)

        is_insert = bool(_INSERT_RE.match(translated))
        has_lastrowid = is_insert and "RETURNING" in translated.upper()

        cur.execute(translated, params or ())
        lastrowid = None
        if has_lastrowid:
            row = cur.fetchone()
            if row is not None:
                lastrowid = row["id"]
        return PgCursor(cur, lastrowid=lastrowid)

    def executescript(self, script):
        # psycopg3 no permite ejecutar varias sentencias de golpe en una
        # llamada: separamos el script por ';' y las ejecutamos una a una.
        script = "\n".join(
            line for line in script.splitlines()
            if not line.strip().startswith("--")
        )
        for statement in script.split(";"):
            statement = statement.strip()
            if not statement:
                continue
            self._conn.execute(statement)
        self._conn.commit()

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


# =====================================================================
# Fábrica de conexiones
# =====================================================================
def _get_postgres_connection():
    import psycopg

    kwargs = {}
    if "sslmode" not in Config.DATABASE_URL.lower():
        kwargs["sslmode"] = Config.DATABASE_SSL
    try:
        conn = psycopg.connect(Config.DATABASE_URL, **kwargs)
    except psycopg.OperationalError as exc:
        raise RuntimeError(
            "No se pudo conectar a PostgreSQL/Supabase. Revisa DATABASE_URL "
            f"en backend/.env. Detalle: {exc}"
        ) from exc
    return PostgresConnection(conn)


def get_connection():
    """Devuelve una conexión a la base de datos.

    - Si en backend/.env hay DATABASE_URL  → conexión a Supabase (PostgreSQL)
    - Si no                                   → SQLite (archivo data.db)

    En ambos casos la conexión se comporta igual: `.execute()`, `.commit()`,
    filas accesibles por nombre (fila["title"]).
    """
    if Config.DATABASE_URL:
        return _get_postgres_connection()

    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    # Activa las claves foráneas (en SQLite vienen apagadas por defecto;
    # sin esto, ON DELETE CASCADE no funcionaría).
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def create_tables():
    """Crea todas las tablas a partir del esquema correspondiente.

    - SQLite usa database/schema.sql
    - PostgreSQL/Supabase usa database/schema_postgres.sql
    """
    conn = get_connection()
    schema_file = SCHEMA_POSTGRES_PATH if Config.DATABASE_URL else SCHEMA_PATH
    conn.executescript(schema_file.read_text(encoding="utf-8"))
    conn.commit()
    conn.close()
    print("Tablas creadas correctamente.")

    # Seed de un administrador inicial para poder entrar al panel.
    seed_admin()


def seed_admin():
    """Crea un administrador por defecto (si no existe) para poder
    probar el panel desde el primer arranque.

    NOTA: en producción se crea el admin manualmente y se cambia la clave.
    """
    from auth import hash_password

    conn = get_connection()
    cur = conn.execute("SELECT id FROM users WHERE email = ?",
                       (Config.ADMIN_EMAIL,))
    if cur.fetchone() is None:
        conn.execute(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES (?, ?, ?, 'ADMIN')",
            ("Administrador", Config.ADMIN_EMAIL,
             hash_password(Config.ADMIN_PASSWORD)),
        )
        conn.commit()
        print(f"Administrador inicial creado: {Config.ADMIN_EMAIL}")
    conn.close()