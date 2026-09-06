# IAFAM Jobs

Plataforma inteligente de oportunidades profesionales para estudiantes y
graduados del sector informático. Centraliza, clasifica, valida y analiza
ofertas de empleo provenientes de múltiples fuentes.

> Estado actual: **MVP funcional (Fase 1)** · Backend + Frontend + Tests OK
> Documento Maestro → `docs/00-master-document.md` · SRS → `docs/01-srs.md`

## Estructura del frontend

```
frontend/
├── index.html
├── src/
│   ├── main.jsx            # Arranque de React
│   ├── App.jsx             # Router + barra de navegación + guardias
│   ├── api.js              # Capa de llamadas al backend (fetch + JWT)
│   ├── styles.css          # Sistema de diseño (chips, cards, tablas)
│   ├── components/         # Componentes reutilizables (JobCard)
│   └── pages/
│       ├── Home.jsx        # Lista de ofertas + búsqueda + filtros
│       ├── JobDetail.jsx   # Detalle + favorito
│       ├── Login.jsx / Register.jsx
│       ├── Profile.jsx     # Datos + favoritos
│       └── admin/          # Panel: Dashboard, Ofertas, JobForm, Empresas
```

## Stack del MVP

| Capa      | Tecnología                |
| --------- | ------------------------- |
| Backend   | Python + Flask + SQL puro |
| Base datos| SQLite (dev) → PostgreSQL (producción) |
| Auth      | JWT (PyJWT)               |
| Frontend  | React (próximo paso)      |

## Estructura

```
iafam-jobs/
├── backend/         # Flask API (config, database, models, routes, auth)
├── database/        # Esquema SQL (schema.sql SQLite + schema_postgres.sql)
├── docs/            # Documentación: Maestro, SRS, etc.
├── frontend/        # React (en construcción)
├── tests/           # Pruebas automatizadas
└── scripts/         # Utilidades (seed, backups, etc.)
```

## Cómo arrancar el backend

```powershell
# 1. Entorno virtual
python -m venv .venv

# 2. Dependencias
.\.venv\Scripts\pip install -r backend\requirements.txt

# 3. Ejecutar (crea data.db + admin inicial)
cd backend
..\.venv\Scripts\python app.py
```

Abrir `http://localhost:5000`.

**Admin inicial (dev):** `admin@iafam.dev` / `admin1234`
> Cámbialo en `.env` (SECRET_KEY y admin) antes de subir el proyecto.

## Cómo arrancar el frontend (en otra terminal)

```powershell
cd frontend
npm install          # solo la primera vez
npm run dev          # servidor de desarrollo en http://localhost:5173
```

Abrir `http://localhost:5173`. El proxy reenvía `/api` al backend
(`http://localhost:5000`) automáticamente.

> Arranca SIEMPRE el backend primero (crea la BD y el admin), y luego el
> frontend. El frontend reenvía cada llamada `/api/*` al backend.

## Endpoints principales (MVP)

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/login` | Login → token |
| GET | `/api/jobs` | Ofertas activas + filtros (`q, category_id, level, mode, type, page`) |
| GET | `/api/jobs/<id>` | Detalle de oferta |
| GET | `/api/categories` ` /api/skills` ` /api/companies` | Catálogos |
| POST | `/api/jobs/<id>/favorite` | Guardar favorito (auth) |
| *Admin:* | `/api/admin/jobs` `/api/admin/companies` `/api/admin/categories` `/api/admin/skills` `/api/admin/stats` `/api/admin/users` | Gestión (rol ADMIN) |

## SQLite → PostgreSQL

El esquema está escrito para que migrar sea mínimo: existe
`database/schema.sql` (SQLite, para desarrollo) y `database/schema_postgres.sql`
(PostgreSQL, para producción). El código SQL es casi idéntico; la única pieza
que se reemplaza es `backend/database.py` (conexión). Lo haremos al pasar a
despliegue.