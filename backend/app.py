"""Punto de arranque de la aplicación Flask.

Qué hace este archivo:
  1. Crea la instancia de la app Flask.
  2. Configura CORS (para que el frontend React pueda llamar a la API).
  3. Registra el "Blueprint" de rutas (routes.py) con prefijo /api.
  4. Crea las tablas de la base de datos al arrancar (si no existen).
  5. Sirve la app y, si existe, la carpeta ../frontend como archivos estáticos.

Cómo se ejecuta:
    python app.py        → inicia el servidor en http://localhost:5000
"""
from flask import Flask, send_from_directory
from flask_cors import CORS
from pathlib import Path

from config import Config, BASE_DIR
from database import create_tables
from routes import api


def create_app():
    """Función de fábrica: crea y configura la app Flask.

    Estructura la app en una función para que los tests puedan crear una
    instancia nueva cada vez (patrón estándar de Flask).
    """
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS: permite que el frontend en otro puerto (ej. React en 3000)
    # pueda llamar a la API. En producción se restringe a orígenes reales.
    CORS(app, origins=Config.CORS_ORIGINS.split(","))

    # Registramos todas las rutas de la API bajo /api
    app.register_blueprint(api)

    # Servir el frontend estático si existe (para desarrollo simple)
    frontend_dir = BASE_DIR.parent / "frontend"
    if frontend_dir.exists():
        @app.route("/")
        def index():
            return send_from_directory(frontend_dir, "index.html")

    # Crear la base de datos al arrancar (idempotente: solo si no existen las tablas)
    create_tables()

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)