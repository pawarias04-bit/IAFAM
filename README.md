# IAFAM Jobs

Plataforma inteligente de oportunidades profesionales para estudiantes y
graduados del sector informático. Centraliza, clasifica, valida y analiza
ofertas de empleo provenientes de múltiples fuentes.

> Estado actual: **MVP sobre Supabase** · React + PostgreSQL + RLS
> Documento Maestro → `docs/00-master-document.md` · SRS → `docs/01-srs.md`
> Backoffice (roles, permisos, auditoría) → `docs/02-backoffice.md`

## Stack

| Capa            | Tecnología                                      |
| --------------- | ----------------------------------------------- |
| Base de datos   | PostgreSQL 17 (Supabase)                        |
| API             | PostgREST — generada automáticamente del esquema |
| Autenticación   | Supabase Auth (`auth.users` + JWT)              |
| Autorización    | Row Level Security, en la propia base de datos   |
| Frontend        | React 18 + Vite + `@supabase/supabase-js`       |

**No hay servidor propio.** El navegador habla directamente con Supabase.
Lo que antes decidía un `@require_admin` en Flask, ahora lo decide una
política RLS en PostgreSQL — y esa sí es imposible de saltarse desde el
cliente, porque se evalúa dentro del motor de base de datos.

## Estructura

```
IAFAM/
├── frontend/                  # React (única aplicación)
│   ├── .env.local             # URL + clave anon (NO se sube a git)
│   ├── .env.example           # plantilla
│   └── src/
│       ├── supabaseClient.js  # cliente único de Supabase
│       ├── auth.jsx           # AuthProvider + useAuth (sesión)
│       ├── api.js             # capa de datos pública
│       ├── backofficeApi.js   # capa de datos del backoffice
│       ├── companyApi.js      # capa de datos del portal de empresas
│       ├── App.jsx            # rutas + guardias
│       ├── styles.css         # sistema de diseño (tokens, cristal, páginas)
│       ├── lib/labels.js      # textos de los enums y formato de fechas/salarios
│       ├── components/
│       │   ├── JobCard.jsx    # fila de oferta para listados
│       │   └── ui/            # Button, GlassPanel, Input/Select/Textarea,
│       │                      # ChoiceGroup, Badge, CompanyMark, Modal,
│       │                      # ConfirmDialog, Toast, Loader, EmptyState…
│       └── pages/             # Home, JobDetail, Login, Register,
│                              # Profile, admin/
├── supabase/
│   ├── config.toml
│   ├── migrations/            # el esquema, versionado
│   └── functions/
│       └── manage-user/       # Edge Function: suspender/reactivar en Auth
└── docs/                      # Documento Maestro, SRS
```

## Arrancar

```powershell
cd frontend
npm install     # solo la primera vez
npm run dev     # http://localhost:5173
```

Ya no hay que arrancar ningún backend antes. Si `npm run dev` falla con
"Faltan VITE_SUPABASE_URL...", copia `.env.example` a `.env.local` y
rellena los dos valores desde el panel de Supabase (Project Settings > API).

## Crear el primer administrador

El registro siempre crea usuarios con rol `USER`; no hay forma de darse
permisos de admin desde la aplicación (esa es justamente la idea). El
primer admin se promueve a mano, una sola vez:

1. Regístrate normalmente en `/register`.
2. En el panel de Supabase → **SQL Editor**, ejecuta:

```sql
UPDATE public.profiles
SET role = 'ADMIN'
WHERE email = 'tu-email@ejemplo.com';
```

3. Cierra sesión y vuelve a entrar. Aparecerá el enlace **Panel**.

Los **moderadores** se nombran igual, con `role = 'MODERATOR'`. Desde el
SQL Editor no hay restricciones de permisos (cuenta como acción del
sistema), pero sí se aplica una: nunca puede quedarse la plataforma sin
un administrador activo.

## El modelo de datos

20 tablas. Las relevantes:

| Tabla        | Para qué                                               |
| ------------ | ------------------------------------------------------ |
| `profiles`   | Datos de perfil. Su `id` **es** el de `auth.users`      |
| `jobs`       | Ofertas. `status` controla la visibilidad pública       |
| `companies`  | Empresas                                                |
| `categories` / `skills` | Catálogos (sembrados con datos iniciales)    |
| `favorites` / `applications` / `alerts` | Actividad del usuario     |
| `reports`    | Ofertas reportadas por usuarios                         |
| `permissions` / `role_permissions` | Catálogo de permisos y qué tiene cada rol |
| `job_status_transitions` | Cambios de estado permitidos para una oferta |
| `app_settings` | Configuración editable (interruptores, límites)      |
| `audit_log`  | Quién hizo qué y cuándo; lo escriben triggers           |

Vistas y funciones:

- `jobs_public` — aplana empresa, categoría y skills en una sola fila, para
  que el frontend no tenga que hacer *joins*. Respeta RLS
  (`security_invoker`).
- `get_admin_stats()` — los KPIs del dashboard en una llamada.
- `toggle_favorite(job_id)` — alterna favorito sin dos viajes al servidor.
- `has_permission(código)` — usada por las políticas y triggers. Es
  `SECURITY DEFINER` para poder leer `profiles` sin disparar recursión
  infinita en RLS.
- `my_permissions()` — la lista de permisos del usuario, para que la
  interfaz decida qué botones mostrar.

### Cómo se aplican las reglas

- **Anónimo**: ve ofertas con `status = 'ACTIVE'`, empresas activas y los
  catálogos. Nada más. No ve ni un solo perfil.
- **Autenticado**: lo anterior, más *sus* favoritos, candidaturas, alertas
  y su propio perfil.
- **Moderador**: lo que le den sus permisos (por defecto: ver todo, editar,
  publicar y verificar ofertas, gestionar empresas y reportes).
- **Admin**: todos los permisos, incluidos borrar, cambiar roles,
  configuración y auditoría.

Nadie puede darse más permisos de los que tiene: el trigger
`profiles_protect` rechaza con un mensaje claro los cambios de `role`,
`is_active` y `email` no autorizados, y solo un administrador puede dar o
quitar el rol de administrador. La matriz completa y todas las reglas están
en `docs/02-backoffice.md`.

## Migraciones

El esquema vive en `supabase/migrations/`, en orden:

| Archivo | Qué hace |
| ------- | -------- |
| `..._iafam_native_schema.sql` | Tablas, triggers, RLS, vistas, RPC y seed |
| `..._harden_functions.sql` | Revoca el `EXECUTE` que Postgres concede a `PUBLIC` — sin esto, las funciones de trigger quedan expuestas como endpoints `/rest/v1/rpc/...` |
| `..._split_anon_policies.sql` | Separa las políticas de lectura por rol, para que `anon` no necesite ejecutar `is_admin()` |
| `..._backoffice_foundation.sql` | Backoffice etapa A: roles, permisos, transiciones de estado, configuración y auditoría |
| `..._backoffice_rls_performance.sql` | Ajustes del Performance Advisor: `auth.uid()` una vez por consulta, políticas separadas e índices |
| `..._backoffice_stage_b.sql` | Backoffice etapa B: verificación de empresas, reportes, notas internas, funciones de moderación, historial, auditoría y usuarios |
| `..._backoffice_stage_c.sql` | Etapa C: portal de empresas (equipos, alta, ofertas propias con revisión) y sello de empresa verificada |

Las migraciones se aplican con el MCP de Supabase (`apply_migration`) y el
mismo SQL se guarda aquí con la versión que devuelve `list_migrations`.

## Búsqueda

La columna `jobs.fts` es un `tsvector` en español con índice GIN, que
combina título (peso A), nombre de la empresa (B) y descripción (C). La
mantienen dos triggers: uno sobre `jobs` y otro sobre `companies`, para que
renombrar una empresa reindexe sus ofertas.

Desde el frontend:

```js
supabase.from('jobs_public')
  .select('*')
  .textSearch('fts', 'python junior', { type: 'websearch', config: 'spanish' })
```

## Backoffice

En `/admin`, para administradores y moderadores. Cada sección aparece solo
con su permiso y todas las decisiones quedan en la auditoría con su motivo.

| Sección | Para qué |
| ------- | -------- |
| Resumen | Lo pendiente hoy y las cifras |
| Moderación | Ofertas en revisión, reportes de usuarios y empresas por verificar |
| Ofertas / Empresas / Usuarios | Listados con filtros y fichas con notas internas e historial |
| Catálogos | Áreas, tecnologías, ubicaciones y fuentes |
| Auditoría | Todo lo que ha cambiado, quién y por qué |
| Roles y permisos | Qué puede hacer un moderador |
| Configuración | Interruptores y límites de la plataforma |

Suspender una cuenta pasa por la Edge Function `manage-user`, porque bloquear
el acceso en Supabase Auth necesita la clave `service_role`, que nunca va en
el navegador. Especificación completa: `docs/02-backoffice.md`.

## Portal de empresas

En `/empresa`. Una empresa se da de alta sola, prepara sus ofertas y las
envía a revisión; el equipo de IAFAM las publica o explica qué corregir.

| Quién | Puede |
| ----- | ----- |
| Administra la empresa | Editar la ficha, pedir la verificación, gestionar el equipo y publicar ofertas |
| Publica | Crear y editar las ofertas de esa empresa |
| Equipo de IAFAM | Verificar la empresa, aprobar o rechazar cada oferta, y gestionar su equipo desde la ficha |

Reglas que aplica la base de datos, no la interfaz:

- Una empresa **no publica sola** mientras el ajuste
  `moderation.company_jobs_require_review` esté activo.
- Editar una oferta publicada la devuelve a revisión.
- Una empresa verificada que cambia de nombre o web vuelve a revisión.
- Solo se borran borradores; lo publicado se cierra.

El portal se abre y se cierra desde **Configuración** con
`features.company_portal`. Ahora está **cerrado**: mientras lo esté, las
ofertas solo las publica el equipo desde el backoffice.
