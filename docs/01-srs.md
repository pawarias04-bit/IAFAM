# 📘 DOCUMENTO DE REQUISITOS DEL SISTEMA (SRS)

# IAFAM Jobs — Plataforma inteligente de oportunidades profesionales para el sector informático

**Versión:** 1.0
**Estado:** Borrador preliminar
**Base:** Documento Maestro v1.0 (`docs/00-master-document.md`)
**Tipo:** Especificación de requisitos de software

---

# 1. Introducción

## 1.1 Propósito

Este documento especifica los requisitos funcionales y no funcionales de **IAFAM Jobs**, la plataforma web destinada a centralizar, organizar, validar y analizar oportunidades profesionales del sector informático.

El documento está escrito para servir de contrato entre la idea, el diseño y la implementación: **todo lo que se construya debe poder trazarse a un requisito de este documento**.

## 1.2 Alcance

Este SRS cubre la plataforma completa en su visión a largo plazo, pero define **explícitamente** qué entra en el **MVP (Etapas 0-3 del roadmap)** y qué queda para fases posteriores (4-8).

## 1.3 Convenciones

Cada requisito funcional tiene un identificador:

```text
RF-XXX   → Requisito funcional
RNF-XXX  → Requisito no funcional
```
Prioridades:

```text
[MVP]  → Obligatorio para la primera versión funcional
[F2]   → Fase 2 (plataforma)
[F3]   → Fase 3 (data engineering)
[F4]   → Fase 4 (inteligencia)
[F5]   → Fase 5 (analytics)
```

## 1.4 Definiciones

| Término | Significado |
| ------- | ----------- |
| Oferta / Vacante | Una oportunidad laboral (empleo, pasantía, práctica, beca, formación) |
| Fuente | Lugar de donde proviene una oferta (API, RSS, manual, web, etc.) |
| Fuente oficial | Fuente autorizada y controlada por el administrador |
| Match / Matching | Cálculo de compatibilidad entre perfil de usuario y oferta |
| Revisor | Rol futuro entre usuario y administrador (validación de ofertas) |
| PWA | Progressive Web App (aplicación web instalable) |

---

# 2. Descripción general

## 2.1 Perspectiva del producto

IAFAM Jobs es una aplicación web (PWA) con:

```text
FRONTEND (React)  ⇄  API REST (Flask)  ⇄  PostgreSQL
```

En el MVP **no** hay Redis, RabbitMQ, n8n, workers ni NLP. Se añadirán cuando el problema lo demande.

## 2.2 Usuarios (actores)

| Actor | Descripción |
| ----- | ----------- |
| **Visitante** | Persona sin cuenta que navega y ve ofertas públicas |
| **Usuario** | Estudiante o graduado registrado: guarda, postula, crea alertas |
| **Administrador** | Gestiona ofertas, empresas, fuentes, categorías, reportes, usuarios |
| **Revisor** | Futuro (Fase 2): revisa y verifica ofertas |

## 2.3 Funcionalidades clave (MVP)

1. Registro y autenticación.
2. Exploración de ofertas públicas.
3. Búsqueda y filtrado (área, nivel, modalidad, tipo).
4. Detalle de una oferta.
5. Creación y gestión de ofertas por administrador.
6. Gestión de empresas y categorías por administrador.
7. Favoritos por usuario.
8. Panel de administración con estadísticas básicas.
9. Validación básica de ofertas (estado + verificación).

## 2.4 Supuestos y dependencias

- El sistema se ejecuta inicialmente en local (desarrollo) y posteriormente en un VPS.
- La base de datos del MVP será **PostgreSQL**.
- La autenticación usará tokens (JWT) emitidos por el backend.
- Las ofertas pueden incorporarse manualmente o por importación (importación = F2, fuera del MVP).
- El contenido de las ofertas se guarda en español e inglés según lo introducido por el administrador.

---

# 3. Requisitos funcionales por módulo

> Nota de trazabilidad: cada requisito está pensado para que después se defina **qué pantalla lo implementa** (sección 5) y **qué endpoint lo expone** (sección 7).

## 3.1 Autenticación y usuarios

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-001 | El sistema permite registrar un usuario con nombre, email, contraseña y carrera/área | [MVP] |
| RF-002 | El sistema valida que el email sea único y tenga formato válido | [MVP] |
| RF-003 | El sistema almacena las contraseñas con hash (werkzeug/scrypt) | [MVP] |
| RF-004 | El sistema permite iniciar sesión con email + contraseña y devuelve un token | [MVP] |
| RF-005 | El sistema permite cerrar sesión (el token deja de usarse en el cliente) | [MVP] |
| RF-006 | El sistema devuelve el perfil del usuario autenticado | [MVP] |
| RF-007 | El sistema permite actualizar perfil: nombre, carrera, universidad, año de graduación, área de interés, nivel, modalidad preferida, skills | [MVP] |
| RF-008 | El sistema diferencia roles: `USER` y `ADMIN` | [MVP] |
| RF-009 | El sistema permite a un administrador crear otro administrador | [MVP] |
| RF-010 | El sistema permite recuperar contraseña por email | [F2] |
| RF-011 | El sistema permite cambio de contraseña estando autenticado | [F2] |

## 3.2 Ofertas (visión pública)

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-020 | El sistema muestra una lista de ofertas públicas (solo las ACTIVAS) | [MVP] |
| RF-021 | La lista se muestra con tarjetas: título, empresa, categoría, nivel, modalidad, ubicación, fecha | [MVP] |
| RF-022 | El sistema permite ver el detalle completo de una oferta (sección 5.3) | [MVP] |
| RF-023 | El sistema permite buscar por texto libre (título, descripción, skills, empresa) | [MVP] |
| RF-024 | El sistema permite filtrar por categoría/área | [MVP] |
| RF-025 | El sistema permite filtrar por nivel (Internship, Junior, Mid, Senior) | [MVP] |
| RF-026 | El sistema permite filtrar por modalidad (Remote, Hybrid, On-site) | [MVP] |
| RF-027 | El sistema permite filtrar por tipo (Full-time, Part-time, Internship, Freelance, Contract) | [MVP] |
| RF-028 | El sistema permite ordenar por fecha (más recientes primero) | [MVP] |
| RF-029 | La lista de ofertas es paginada (configurable, p. ej. 20 por página) | [MVP] |
| RF-030 | El sistema muestra la oferta con sus skills como etiquetas | [MVP] |
| RF-031 | El sistema muestra el estado de verificación de la oferta (🟢/🟡/🔴) | [MVP] |
| RF-032 | El sistema muestra las fuentes de las que proviene una oferta | [F2] |

## 3.3 Ofertas (gestión administrador)

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-040 | El administrador puede crear una oferta (formulario con campos de sección 4.2) | [MVP] |
| RF-041 | El administrador puede editar una oferta | [MVP] |
| RF-042 | El administrador puede eliminar (o desactivar) una oferta | [MVP] |
| RF-043 | El administrador puede cambiar el estado de la oferta (DRAFT, PENDING_REVIEW, ACTIVE, EXPIRED, CLOSED, REJECTED) | [MVP] |
| RF-044 | Al crear una oferta, si se pone estado ACTIVE, se considera publicada | [MVP] |
| RF-045 | El sistema marca automáticamente como EXPIRED las ofertas cuya fecha límite ya pasó | [F2] |
| RF-046 | El sistema conserva el texto original y URL original al importar | [F2] |
| RF-047 | El administrador puede buscar ofertas por cualquier campo en el panel | [F2] |
| RF-048 | El administrador puede cambiar el estado de verificación (VERIFIED/PENDING/REPORTED) | [MVP] |

## 3.4 Empresas

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-050 | El administrador puede crear una empresa (nombre, logo, descripción, web, ubicación) | [MVP] |
| RF-051 | El administrador puede editar y desactivar una empresa | [MVP] |
| RF-052 | El sistema evita empresas duplicadas por nombre | [MVP] |
| RF-053 | Una oferta debe asociarse a una empresa existente | [MVP] |
| RF-054 | El administrador puede ver las ofertas de una empresa | [F2] |

## 3.5 Categorías y skills

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-060 | El sistema ofrece categorías de área (Desarrollo, Datos, QA, Diseño, Infraestructura, Seguridad, IA, Bioinformática) | [MVP] |
| RF-061 | El administrador puede crear categorías nuevas | [MVP] |
| RF-062 | Una oferta pertenece a una categoría principal | [MVP] |
| RF-063 | El sistema ofrece un catálogo de skills (Python, SQL, Docker, React, etc.) | [MVP] |
| RF-064 | El administrador puede crear skills nuevas | [MVP] |
| RF-065 | Una oferta puede tener varios skills (relación muchos a muchos) | [MVP] |
| RF-066 | El sistema permite asignar/desasignar skills a una oferta desde el panel | [MVP] |

## 3.6 Favoritos

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-070 | Un usuario autenticado puede guardar una oferta como favorita | [MVP] |
| RF-071 | Un usuario puede quitar una oferta de favoritos | [MVP] |
| RF-072 | Un usuario puede ver su lista de favoritos | [MVP] |
| RF-073 | El sistema muestra en el detalle si la oferta ya es favorita del usuario | [MVP] |
| RF-074 | El sistema evita duplicar favoritos (usuario + oferta única) | [MVP] |

## 3.7 Postulaciones y seguimiento

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-080 | Un usuario autenticado puede registrar una postulación a una oferta | [F2] |
| RF-081 | El usuario puede cambiar el estado de su postulación (APPLIED, INTERVIEW, ACCEPTED, REJECTED) | [F2] |
| RF-082 | El usuario puede ver su historial de postulaciones | [F2] |
| RF-083 | El sistema evita postulaciones duplicadas del mismo usuario a la misma oferta | [F2] |

## 3.8 Alertas

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-090 | Un usuario autenticado puede crear una alerta (área, nivel, modalidad, skills) | [F2] |
| RF-091 | El usuario puede listar, editar y eliminar sus alertas | [F2] |
| RF-092 | El sistema genera notificaciones cuando aparece una oferta que cumple la alerta | [F2] |
| RF-093 | El usuario puede activar/desactivar una alerta | [F2] |

## 3.9 Reportes

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-100 | Un usuario autenticado puede reportar una oferta (falsa, duplicada, expirada, incorrecta, enlace roto) | [F2] |
| RF-101 | El administrador ve la lista de reportes | [F2] |
| RF-102 | El administrador puede resolver un reporte (APROBADO/RECHAZADO) | [F2] |
| RF-103 | Al resolver un reporte, puede cambiar el estado de verificación de la oferta | [F2] |

## 3.10 Fuentes

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-110 | El sistema registra la fuente de cada oferta (name, type, url) | [F2] |
| RF-111 | El administrador puede gestionar fuentes | [F2] |
| RF-112 | El sistema detecta ofertas duplicadas antes de insertar y advierte | [F2] |
| RF-113 | El sistema agrupa fuentes de una misma oferta | [F2] |
| RF-114 | El administrador puede importar ofertas desde archivos/APIs/RSS | [F3] |

## 3.11 Verificación

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-120 | Toda oferta tiene `verification_status` (VERIFIED, PENDING, REPORTED) | [MVP] |
| RF-121 | El sistema registra quién y cuándo verificó cada oferta | [F2] |
| RF-122 | Las ofertas verificación pendiente se distinguen visualmente | [MVP] |

## 3.12 Panel administrativo

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-130 | El administrador ve un dashboard con: ofertas totales, activas, pendientes, expiradas, reportadas | [MVP] |
| RF-131 | El panel muestra las últimas ofertas pendientes de revisión | [MVP] |
| RF-132 | El panel muestra conteo de ofertas por estado | [MVP] |
| RF-133 | El panel muestra conteo de ofertas por categoría | [MVP] |
| RF-134 | El panel permite acceder a la gestión de ofertas, empresas, categorías, skills, usuarios | [MVP] |
| RF-135 | El administrador puede desactivar/activar usuarios | [MVP] |
| RF-136 | El administrador puede ver los usuarios registrados | [MVP] |

## 3.13 Matching y recomendaciones

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-140 | El sistema calcula un % de compatibilidad entre perfil y oferta | [F4] |
| RF-141 | El sistema muestra al usuario ofertas recomendadas en el inicio | [F4] |
| RF-142 | El sistema explica las razones del match (skills comunes, nivel, modalidad) | [F4] |
| RF-143 | El sistema permite al usuario marcar intereses y skills para mejorar el matching | [MVP: perfil] [F4: motor] |

## 3.14 Datos y analítica

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RF-150 | El dashboard admin muestra un ranking de skills más demandados | [F3] |
| RF-151 | El sistema genera estadísticas de ofertas por modalidad | [F3] |
| RF-152 | El sistema genera tendencias temporales de ofertas | [F5] |
| RF-153 | El sistema expone un observatorio de mercado (puestos, tecnologías, crecimiento) | [F5] |
| RF-154 | El sistema analiza descripciones con NLP para extraer skills, nivel, modalidad | [F4] |

---

# 4. Requisitos de datos

## 4.1 Entidades principales (vista conceptual)

```text
users
companies
categories
skills
locations
jobs
job_skills          (N:M job ↔ skill)
sources
job_sources         (N:M job ↔ source)
favorites           (usuario ↔ oferta)
applications        (postulaciones)
alerts
reports
```

## 4.2 Campos de la oferta (JOB)

```text
id                  PK
title               obligatorio
description         obligatorio (texto largo)
company_id          FK
category_id         FK
location_id         FK (opcional)
employment_type     FULL_TIME | PART_TIME | INTERNSHIP | FREELANCE | CONTRACT
work_mode           REMOTE | HYBRID | ON_SITE
experience_level    INTERNSHIP | JUNIOR | MID | SENIOR
salary_min          opcional (numerico)
salary_max          opcional (numerico)
currency            opcional (ISO 4217, p. ej. USD, CUP, EUR)
publication_date    fecha
deadline            fecha limite (opcional)
status              DRAFT | PENDING_REVIEW | ACTIVE | EXPIRED | CLOSED | REJECTED
verification_status VERIFIED | PENDING | REPORTED
contact_email       opcional
contact_phone       opcional
apply_url           opcional (enlace de postulacion)
original_text       opcional (texto crudo para NLP futuro)
original_url        opcional
created_at
updated_at
```

## 4.3 Campos del usuario (USER)

```text
id
name
email               unico
password_hash
role                USER | ADMIN
career              opcional
university          opcional
graduation_year     opcional
experience_level    opcional
preferred_mode      opcional (REMOTE/HYBRID/ON_SITE)
interests           opcional (lista de categorias)
skills              N:M con catalogo de skills
is_active
created_at
```

## 4.4 Reglas de integridad (MVP)

- `jobs.status` y `jobs.verification_status` son enumerados controlados.
- Una oferta solo se muestra al público si `status = ACTIVE`.
- `favorites` tiene unicidad `(user_id, job_id)`.
- `companies.name` tiene unicidad insensible a mayúsculas.
- `skills.name` tiene unicidad.
- `users.email` tiene unicidad.

---

# 5. Pantallas del sistema (navegación)

## 5.1 Mapa de pantallas MVP

```text
                        ┌─────────────┐
                        │  HOME       │  (pública: lista de ofertas + filtros)
                        └──────┬──────┘
                               │
              ┌────────────────┼──────────────────┐
              ↓                ↓                  ↓
      ┌──────────────┐  ┌─────────────┐   ┌──────────────┐
      │ Iniciar sesión│  │ Detalle     │   │ Registro     │
      │ /login       │  │ oferta      │   │ /register    │
      └──────┬───────┘  └──────┬──────┘   └──────┬───────┘
             ↓                 │                 ↓
      ┌──────────────┐         │         Manda a /login tras registro
      │ Perfil       │◄────────┴──► guardar favorito
      │ /profile     │
      └──────────────┘
             │
             ↓  (admin)
      ┌──────────────────────┐
      │ ADMIN DASHBOARD      │
      │ /admin/dashboard     │
      ├──────────────────────┤
      │ /admin/jobs          │  lista + crear/editar/estado
      │ /admin/jobs/new      │  formulario de oferta
      │ /admin/jobs/:id/edit │
      │ /admin/companies     │  gestion de empresas
      │ /admin/categories    │  categorias y skills
      │ /admin/users         │  gestion de usuarios
      └──────────────────────┘
```

## 5.2 Pantalla: HOME (lista de ofertas)

**Elementos visibles:**

- Barra de navegación: logo, buscar, links (login/registro o perfil), si es admin: "Panel".
- Campo de búsqueda de texto.
- Filtros: Área, Nivel, Modalidad, Tipo, Empresa.
- Botón "Limpiar filtros".
- Lista de tarjetas de ofertas.
- Paginación ("← Anterior" / "Siguiente →").
- Chip de verificación por tarjeta.

**Acciones de usuario:**

| Acción | Comportamiento |
| ------ | -------------- |
| Escribir en buscador y Enter | Recarga la lista con el texto como filtro (`?q=`) |
| Cambiar un filtro | Recarga la lista con el filtro aplicado |
| Pulsar "Limpiar filtros" | Quita todos los filtros y recarga |
| Pulsar tarjeta de oferta | Navega al detalle |
| Pulsar "Panel" (admin) | Navega al admin dashboard |
| Pulsar "Iniciar sesión" | Navega a /login |

## 5.3 Pantalla: DETALLE DE OFERTA

**Elementos visibles:**

- Título, empresa (con logo si existe).
- Etiquetas: categoría, nivel, modalidad, tipo.
- Descripción completa.
- Skills como etiquetas.
- Ubicación.
- Salario (si existe) y moneda.
- Fecha de publicación y fecha límite.
- Estado de verificación (🟢/🟡/🔴).
- URL de postulación / email de contacto (si existe).
- Botón "Guardar" / "Guardado" (favorito) si hay sesión.
- Fuentes de la oferta (F2).

**Acciones:**

| Acción | Comportamiento |
| ------ | -------------- |
| Pulsar "Guardar" | Añade a favoritos; el botón cambia a "Guardado ✓" |
| Pulsar "Guardado ✓" | Quita de favoritos; el botón vuelve a "Guardar" |
| Pulsar "Postularme" (enlace) | Abre la URL de postulación en otra pestaña (F2) |

## 5.4 Pantalla: LOGIN / REGISTRO

**Login:**

- Email, contraseña, botón "Entrar".
- Error visible si credenciales inválidas.
- Enlace a /register si no tiene cuenta.

**Registro:**

- Nombre, email, contraseña, confirmar contraseña, carrera (opcional).
- Validaciones: email válido, contraseña ≥ 8 caracteres, contraseñas coinciden, email no registrado.
- Botón "Crear cuenta".
- Tras registrarse: se inicia sesión automáticamente y se redirige a /profile.

## 5.5 Pantalla: PERFIL

**Elementos:**

- Datos editables: nombre, carrera, universidad, año de graduación.
- Preferencias: áreas de interés, nivel, modalidad preferida.
- Skills del usuario.
- Sección "Mis favoritos" (lista de tarjetas guardadas).

**Acciones:**

| Acción | Comportamiento |
| ------ | -------------- |
| Editar y guardar | PUT al endpoint de perfil; muestra confirmación |
| Quitar favorito | Elimina de la lista |

## 5.6 Pantalla: ADMIN — DASHBOARD

**Elementos:**

- KPI: total, activas, pendientes, expiradas, reportadas.
- Tabla "Pendientes de revisión" con accesos rápidos a cada oferta.
- Gráfico simple: ofertas por estado.
- Menú lateral: Ofertas, Empresas, Categorías, Skills, Usuarios.

**Acciones:**

| Acción | Comportamiento |
| ------ | -------------- |
| Pulsar KPI "Pendientes" | Filtra la lista de ofertas por estado PENDING_REVIEW |
| Pulsar "Nueva oferta" | Navega al formulario de creación |

## 5.7 Pantalla: ADMIN — FORMULARIO DE OFERTA

**Campos del formulario:**

- Título*, Descripción*, Empresa*, Categoría*, Nivel*, Modalidad*, Tipo*, Ubicación.
- Salario mín, salario máx, moneda.
- Fecha publicación (por defecto hoy), Fecha límite.
- Estado, Estado de verificación.
- Contacto: email, teléfono, URL de postulación.
- Skills (select múltiple).
- Botones: "Guardar", "Guardar y publicar", "Cancelar".

**Acciones:**

| Acción | Comportamiento |
| ------ | -------------- |
| Guardar | Crea/actualiza la oferta; redirige a la lista |
| Guardar y publicar | Crea con estado ACTIVE y verificación VERIFIED; redirige |
| Cancelar | Vuelve a la lista sin guardar |

---

# 6. Reglas de negocio clave

## 6.1 Visibilidad

```text
status = ACTIVE  → visible para todos
otro status      → solo visible en el panel admin
```

## 6.2 Favoritos

- Solo usuarios autenticados.
- No se puede duplicar (usuario, oferta).

## 6.3 Empresas

- Debe existir antes de crear la oferta que la referencia.
- Nombre único (insensible a mayúsculas).

## 6.4 Seguridad de contraseñas

- Hash con werkzeug (scrypt).
- Mínimo 8 caracteres.

## 6.5 Estados de ofertas (transiciones MVP)

```text
DRAFT ──► PENDING_REVIEW ──► ACTIVE ──► CLOSED
   │              │            │
   └──────────────┴────────────┴──► REJECTED
                              EXPIRED  (automático F2)
```

---

# 7. Requisitos de la API (endpoints MVP)

Base: `/api`

## 7.1 Autenticación

| Método | Ruta | Descripción | Protegida |
| ------ | ---- | ----------- | --------- |
| POST | `/api/auth/register` | Registro de usuario | No |
| POST | `/api/auth/login` | Login → token | No |
| GET | `/api/auth/me` | Perfil autenticado | Sí |

## 7.2 Usuarios / perfil

| Método | Ruta | Descripción | Protegida |
| ------ | ---- | ----------- | --------- |
| GET | `/api/profile` | Perfil + favoritos + skills | Sí |
| PUT | `/api/profile` | Actualizar perfil | Sí |

## 7.3 Ofertas (público)

| Método | Ruta | Descripción | Protegida |
| ------ | ---- | ----------- | --------- |
| GET | `/api/jobs` | Lista paginada + filtros (`q, category_id, level, mode, type, page`) | No |
| GET | `/api/jobs/<id>` | Detalle de oferta activa | No |

## 7.4 Ofertas (admin)

| Método | Ruta | Descripción | Protegida |
| ------ | ---- | ----------- | --------- |
| GET | `/api/admin/jobs` | Todas las ofertas (todos los estados) | Admin |
| POST | `/api/admin/jobs` | Crear oferta | Admin |
| GET | `/api/admin/jobs/<id>` | Detalle admin | Admin |
| PUT | `/api/admin/jobs/<id>` | Actualizar oferta | Admin |
| DELETE | `/api/admin/jobs/<id>` | Eliminar oferta | Admin |
| PATCH | `/api/admin/jobs/<id>/status` | Cambiar estado | Admin |
| PATCH | `/api/admin/jobs/<id>/verification` | Cambiar verificación | Admin |

## 7.5 Catálogos (admin)

| Método | Ruta | Descripción | Protegida |
| ------ | ---- | ----------- | --------- |
| GET | `/api/categories` | Lista de categorías | No |
| POST | `/api/admin/categories` | Crear categoría | Admin |
| GET | `/api/skills` | Lista de skills | No |
| POST | `/api/admin/skills` | Crear skill | Admin |

## 7.6 Empresas (admin)

| Método | Ruta | Descripción | Protegida |
| ------ | ---- | ----------- | --------- |
| GET | `/api/companies` | Lista de empresas | No |
| POST | `/api/admin/companies` | Crear empresa | Admin |
| PUT | `/api/admin/companies/<id>` | Editar empresa | Admin |
| DELETE | `/api/admin/companies/<id>` | Desactivar empresa | Admin |

## 7.7 Favoritos

| Método | Ruta | Descripción | Protegida |
| ------ | ---- | ----------- | --------- |
| GET | `/api/favorites` | Lista de favoritos | Sí |
| POST | `/api/jobs/<id>/favorite` | Guardar favorito | Sí |
| DELETE | `/api/jobs/<id>/favorite` | Quitar favorito | Sí |

## 7.8 Admin general

| Método | Ruta | Descripción | Protegida |
| ------ | ---- | ----------- | --------- |
| GET | `/api/admin/stats` | KPIs del dashboard | Admin |
| GET | `/api/admin/users` | Lista de usuarios | Admin |
| PATCH | `/api/admin/users/<id>/status` | Activar/desactivar usuario | Admin |

## 7.9 Formato de respuestas (convención)

```json
{ "data": ... }
{ "error": { "code": "...", "message": "..." } }
```

Errores HTTP: `400` (validación), `401` (sin token), `403` (sin permisos), `404` (no existe).

---

# 8. Requisitos no funcionales (RNF)

## 8.1 Seguridad

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RNF-001 | Contraseñas con hash; nunca en claro ni en logs | [MVP] |
| RNF-002 | Tokens JWT con expiración | [MVP] |
| RNF-003 | Endpoints admin protegidos con rol `ADMIN` | [MVP] |
| RNF-004 | Validación de entradas en el backend (nunca confiar solo en el frontend) | [MVP] |
| RNF-005 | Secretos en variables de entorno; `.env` en `.gitignore` | [MVP] |
| RNF-006 | Protección contra inyección SQL (ORM / consultas parametrizadas) | [MVP] |
| RNF-007 | Cabeceras de seguridad (CORS restringido en producción) | [MVP] |
| RNF-008 | Rate limiting en login/registro | [F2] |
| RNF-009 | HTTPS en producción | [F2] |
| RNF-010 | Logs de eventos sensibles (login, cambios de estado) | [F2] |

## 8.2 Rendimiento y escalabilidad

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RNF-020 | La lista de ofertas responde en < 300 ms con datos de desarrollo | [MVP] |
| RNF-021 | Índices en: jobs.status, jobs.category_id, jobs.publication_date, favorites(user_id) | [MVP] |
| RNF-022 | Cache con Redis para catálogos estáticos (categorías, skills) | [F3] |

## 8.3 Usabilidad

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RNF-030 | Interfaz responsive (móvil, tablet, PC) | [MVP] |
| RNF-031 | PWA instalable desde el navegador | [F2] |
| RNF-032 | Mensajes de error comprensibles en cada formulario | [MVP] |
| RNF-033 | Carga de estados vacíos claros ("No hay ofertas con estos filtros") | [MVP] |

## 8.4 Fiabilidad y mantenibilidad

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RNF-040 | Tests automatizados del backend (pytest) | [MVP] |
| RNF-041 | Esquema de BD versionado con migraciones | [MVP] |
| RNF-042 | Código con estructura por módulos (modelo, rutas, servicios) | [MVP] |
| RNF-043 | Copias de seguridad de la BD | [F2] |

## 8.5 Compatibilidad

| ID | Requisito | Prioridad |
| -- | --------- | --------- |
| RNF-050 | Navegadores: Chrome, Edge, Firefox, Safari (versiones recientes) | [MVP] |
| RNF-051 | La API responde JSON; el frontend consume la API (sin render server-side) | [MVP] |

---

# 9. Criterios de aceptación del MVP

El MVP se considera completo cuando TODO lo siguiente se cumple:

1. Un visitante puede ver la lista de ofertas activas, buscar y filtrar (RF-020 a RF-031).
2. Un visitante puede registrarse e iniciar sesión (RF-001 a RF-006).
3. Un usuario autenticado puede completar su perfil y guardar favoritos (RF-007, RF-070 a RF-074).
4. Un administrador puede crear, editar, cambiar estado y eliminar ofertas (RF-040 a RF-048).
5. Un administrador puede crear empresas, categorías y skills (RF-050, RF-060 a RF-066).
6. El panel admin muestra los KPIs del dashboard (RF-130 a RF-136).
7. Las ofertas no activas NO son visibles públicamente (RU-6.1).
8. La API sigue las convenciones de la sección 7 y todas las rutas responden correctamente.
9. Los tests backend pasan (pytest).
10. La interfaz es responsive y funciona desde móvil y PC (RNF-030).

---

# 10. Fuera de alcance del MVP (para fases posteriores)

- Postulaciones en línea y seguimiento de candidaturas (F2).
- Alertas y notificaciones (F2).
- Reportes de usuarios (F2).
- Verificación avanzada con fuentes y audit log (F2).
- Importación por API/RSS/archivos y deduplicación (F3).
- Redis, RabbitMQ, n8n, workers (F3).
- NLP, matching y recomendaciones (F4).
- Data warehouse, Power BI, observatorio laboral (F5).
- Recuperación de contraseña (F2).
- Aplicación móvil nativa (indefinido; se prioriza PWA).

---

## 🔥 Siguiente paso

Una vez validado este SRS, el orden de construcción será:

1. **Modelo entidad-relación + migraciones PostgreSQL** (`database/`).
2. **Backend Flask** implementando los endpoints MVP (sección 7) con sus tests.
3. **Frontend React** implementando las pantallas MVP (sección 5).
4. **Integración y puesta a punto CSV (criterios de sección 9).**