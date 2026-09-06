"""Migración completa de SQLite (data.db) → Supabase/PostgreSQL.

CÓMO SE USA (una sola vez, desde la raíz del proyecto):
    1. Poner en backend/.env la línea  DATABASE_URL=postgresql://...
       (Project Settings > Connect > URI de conexión de tu proyecto Supabase)
    2. Ejecutar:
       .\.venv\Scripts\python.exe backend\migrate_to_supabase.py

QUÉ HACE:
    1. Conecta a PostgreSQL (DATABASE_URL) y crea las 15 tablas
       usando schema_postgres.sql.
    2. Lee TODAS las filas de data.db (SQLite) y las inserta en Supabase
       CONSERVANDO los id originales (para no romper las claves foráneas:
       un job apunta a su company por company_id, etc.).
    3. Reajusta las secuencias (SERIAL) al máximo id + 1, para que los
       próximos INSERT no choquen con los datos migrados.

Es seguro repetirlo: usa ON CONFLICT DO NOTHING (si una fila ya existe,
la deja).
"""
import sys
from pathlib import Path

# El script vive en backend/, así que añadimos esa carpeta al path
# para poder importar config.py.
BACKEND = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND))

import sqlite3  # noqa: E402

import psycopg  # noqa: E402

from config import Config  # noqa: E402
from database import PostgresConnection, SCHEMA_POSTGRES_PATH  # noqa: E402

# Orden de copia respetando las dependencias (claves foráneas)
# Las tablas puente van después de las tablas a las que referencian.
TABLES = [
    "categories",
    "skills",
    "locations",
    "users",
    "user_skills",
    "companies",
    "sources",
    "jobs",
    "job_skills",
    "job_sources",
    "favorites",
    "applications",
    "alerts",
    "alert_skills",
    "reports",
]

# Tablas con columna booleana (SQLite guarda 0/1, Postgres quiere TRUE/FALSE)
BOOL_COLUMNS = {
    "users": {"is_active"},
    "companies": {"is_active"},
    "sources": {"is_active"},
    "alerts": {"is_active"},
}


def to_bool_if_needed(table, column, value):
    if column in BOOL_COLUMNS.get(table, set()):
        return bool(value)
    return value


def main():
    if not Config.DATABASE_URL:
        print("ERROR: define DATABASE_URL en backend/.env (ver cabecera).")
        sys.exit(1)

    sqlite_path = Config.DATABASE_PATH
    if not Path(sqlite_path).exists():
        print(f"ERROR: no encuentro {sqlite_path} (BD SQLite origen).")
        sys.exit(1)

    # 1) Conectar a PostgreSQL y crear las tablas (separando sentencias)
    kwargs = {}
    if "sslmode" not in Config.DATABASE_URL.lower():
        kwargs["sslmode"] = Config.DATABASE_SSL
    pg_conn = psycopg.connect(Config.DATABASE_URL, **kwargs)
    wrapper = PostgresConnection(pg_conn)
    schema_sql = SCHEMA_POSTGRES_PATH.read_text(encoding="utf-8")
    wrapper.executescript(schema_sql)
    print("Esquema aplicado en Supabase (tablas creadas).")

    # 2) Copiar los datos
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    total = 0
    for table in TABLES:
        rows = sqlite_conn.execute(
            f'SELECT * FROM "{table}"').fetchall()
        if not rows:
            print(f"  {table:16} 0 filas (vacía)")
            continue

        cols = list(rows[0].keys())
        names = ", ".join(cols)
        placeholders = ", ".join(["%s"] * len(cols))

        for row in rows:
            values = [
                to_bool_if_needed(table, col, row[col]) for col in cols
            ]
            # ON CONFLICT DO NOTHING: si la fila ya existe (por PRIMARY KEY
            # o UNIQUE), la dejamos igual. Así el script es re-ejecutable.
            pg_conn.execute(
                f"INSERT INTO {table} ({names}) VALUES ({placeholders}) "
                f"ON CONFLICT DO NOTHING",
                values,
            )
        pg_conn.commit()
        print(f"  {table:16} {len(rows)} filas")
        total += len(rows)

    # 3) Reajustar secuencias (id de la próxima inserción en cada tabla)
    #    Al insertar ids explícitos, la secuencia SERIAL no se mueve sola;
    #    la ponemos en MAX(id)+1 para que los siguientes INSERT no choquen.
    print("Reajustando secuencias...")
    for table in TABLES:
        seq = pg_conn.execute(
            "SELECT pg_get_serial_sequence(%s, 'id')",
            (table,),
        ).fetchone()[0]
        if not seq:
            continue  # tabla sin columna id (puente): no hay secuencia
        pg_conn.execute(
            "SELECT setval(%s, COALESCE((SELECT MAX(id) FROM "
            f'"{table}"), 1))',
            (seq,),
        )
    pg_conn.commit()

    sqlite_conn.close()
    pg_conn.close()
    print(f"\nMigración completada: {total} filas copiadas a Supabase.")


if __name__ == "__main__":
    main()