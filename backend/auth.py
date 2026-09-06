"""Autenticación: hash de contraseñas y tokens JWT.

QUÉ SIGNIFICA CADA COSA (Paulo):

1) HASH DE CONTRASEÑA:
   Nunca guardamos la contraseña en claro. Aplicamos una función hash
   (werkzeug: scrypt, un algoritmo unidireccional). "Hash" = convertir
   el texto en una cadena ilegible de la que NO se puede volver atrás.
   Así, si alguien roba la BD, no obtiene las contraseñas.

2) TOKEN JWT:
   Cuando el usuario inicia sesión, el servidor le entrega un "pase"
   (token) firmado con una clave secreta. Ese token dice: "este usuario
   tiene id 5 y rol USER". El navegador lo guarda y lo manda en cada
   petición. El servidor verifica la firma y sabe quién es sin tener
   que buscar en la BD cada vez.

   Usamos la librería estándar `PyJWT`. La función `generate_token`
   crea el token; `decode_token` lo valida y devuelve los datos.
   `require_auth` es un "decorador" de Flask que protege rutas: solo
   se ejecuta el endpoint si el token es válido.
"""
import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from config import Config


def hash_password(password: str) -> str:
    """Convierte una contraseña en su hash seguro (para guardar en BD)."""
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Comprueba si una contraseña coincide con su hash almacenado."""
    return check_password_hash(password_hash, password)


def generate_token(user_id: int, user_role: str) -> str:
    """Crea un JWT con el id y rol del usuario.

    El token expira a las Config.TOKEN_TTL_HOURS horas.
    """
    payload = {
        # RFC 7519: "sub" (subject) DEBE ser un string. Así que convertimos
        # el id (int) a string, y al decodificar lo volvemos a int.
        "sub": str(user_id),
        "role": user_role,
        "iat": datetime.now(timezone.utc),   # emitido el...
        "exp": datetime.now(timezone.utc) + timedelta(
            hours=Config.TOKEN_TTL_HOURS),   # expira el...
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Valida un token y devuelve su contenido. Lanza error si es inválido
    o expiró."""
    return jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])


def require_auth(f):
    """Decorador: exige un token válido. Devuelve el id y rol del usuario.

    CÓMO SE USA (ejemplo):
        @app.route("/api/favorites")
        @require_auth
        def list_favorites(user_id, user_role):
            ...
    La función decorada recibe `user_id` y `user_role` automáticamente.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": {"code": "UNAUTHORIZED",
                                       "message": "Falta el token"}}), 401
        token = auth[len("Bearer "):]
        try:
            payload = decode_token(token)
        except jwt.PyJWTError:
            return jsonify({"error": {"code": "UNAUTHORIZED",
                                       "message": "Token inválido o expirado"}}), 401
        # "sub" se guardó como string (RFC 7519), lo convertimos de vuelta
        # a entero porque el resto de la app lo espera así.
        return f(user_id=int(payload["sub"]), user_role=payload["role"],
                 *args, **kwargs)
    return wrapper

def require_admin(f):
    """Decorador: exige ser administrador (composición sobre require_auth)."""
    @wraps(f)
    def wrapper(user_id, user_role, *args, **kwargs):
        if user_role != "ADMIN":
            return jsonify({"error": {"code": "FORBIDDEN",
                                       "message": "Se requiere rol de administrador"}}), 403
        return f(user_id=user_id, user_role=user_role, *args, **kwargs)
    return wrapper
