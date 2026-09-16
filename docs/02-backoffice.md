# 📋 Backoffice de IAFAM Jobs

**Versión:** 1.2 · **Estado:** Etapas A, B y C terminadas; siguiente, Etapa D
**Relación:** amplía el SRS (`01-srs.md`). Los requisitos llevan prefijo `BO-` para no chocar con los `RF-`.

---

# 1. Por qué un backoffice primero

La plataforma va a pasar de "un administrador teclea ofertas" a "empresas publican, usuarios reportan, entra dinero". Antes de abrir esas puertas hace falta poder **ver, decidir y rastrear** todo lo que ocurre. El backoffice no es una pantalla más: es el sistema de control del negocio.

## 1.1 Principios

1. **Nada se publica sin decisión.** Ofertas de empresas, empresas nuevas y reportes pasan por una bandeja de moderación. Aprobar o rechazar deja constancia y motivo.
2. **Todo queda registrado.** La auditoría la escribe la base de datos con triggers; ningún cliente puede saltársela ni borrarla.
3. **Permisos reales, no botones ocultos.** Cada acción exige un permiso comprobado en PostgreSQL (RLS y triggers). La interfaz solo refleja lo que la base de datos ya permite.
4. **Estados cerrados.** Una oferta solo puede moverse por las transiciones definidas; lo demás se rechaza con un mensaje claro.
5. **Configuración sin tocar código.** Precios, límites e interruptores de funciones viven en la base de datos.

## 1.2 Arquitectura

```text
Navegador (React)
   │  consultas con la sesión del usuario
   ▼
Supabase
   ├── PostgreSQL: tablas + RLS (quién ve y escribe qué)
   │              triggers (auditoría, transiciones, campos protegidos)
   └── Edge Functions: efectos fuera de la BD (Telegram, emails,
                       caducidad programada, suspender cuentas de Auth)
```

---

# 2. Roles

| Rol | Quién | Alcance |
| --- | ----- | ------- |
| `USER` | Estudiante o profesional registrado | Su perfil, favoritos, postulaciones, alertas, reportes |
| `MODERATOR` | Persona del equipo | Lo que le concedan sus permisos (sección 3) |
| `ADMIN` | Dueño de la plataforma (superadmin) | Todo, incluidos roles, permisos y configuración |

La pertenencia a una **empresa** no es un rol: será una relación usuario-empresa (Etapa C), para que una misma persona pueda gestionar una empresa y seguir siendo usuaria.

## 2.1 Reglas de seguridad de roles

| ID | Regla |
| -- | ----- |
| BO-001 | Solo un `ADMIN` puede dar o quitar el rol `ADMIN` |
| BO-002 | Siempre debe quedar al menos un `ADMIN` activo |
| BO-003 | Nadie puede suspender su propia cuenta |
| BO-004 | Un `MODERATOR` no puede suspender a un `ADMIN` |
| BO-005 | Un usuario suspendido (`is_active = false`) pierde todos sus permisos al instante |
| BO-006 | Los datos personales de un perfil solo los edita su dueño; el equipo solo cambia rol y estado |
| BO-007 | El email del perfil solo cambia desde la cuenta de acceso (Supabase Auth) |

---

# 3. Permisos

`ADMIN` tiene todos. `MODERATOR` tiene los marcados por defecto; el `ADMIN` puede cambiar la matriz desde el backoffice (Etapa B).

| Permiso | Qué permite | Moderador por defecto |
| ------- | ----------- | :---: |
| `dashboard.view` | Ver el resumen y sus cifras | ✅ |
| `jobs.view_all` | Ver ofertas en cualquier estado | ✅ |
| `jobs.edit` | Crear ofertas y editar su contenido | ✅ |
| `jobs.publish` | Cambiar el estado (publicar, rechazar, cerrar…) | ✅ |
| `jobs.verify` | Cambiar el estado de verificación | ✅ |
| `jobs.delete` | Eliminar ofertas | |
| `companies.view_all` | Ver empresas desactivadas | ✅ |
| `companies.edit` | Crear y editar empresas | ✅ |
| `companies.delete` | Eliminar empresas | |
| `companies.verify` | Verificar o rechazar empresas | ✅ |
| `reports.view` | Ver reportes de usuarios | ✅ |
| `reports.resolve` | Resolver reportes | ✅ |
| `users.view` | Ver usuarios y su actividad | ✅ |
| `users.suspend` | Suspender y reactivar usuarios | |
| `users.change_role` | Cambiar roles (nunca `ADMIN`, ver BO-001) | |
| `catalog.edit` | Editar áreas, skills, ubicaciones y fuentes | |
| `settings.edit` | Cambiar la configuración | |
| `audit.view` | Consultar la auditoría | |

| ID | Requisito |
| -- | --------- |
| BO-010 | Los permisos se comprueban en la base de datos con `has_permission(código)` |
| BO-011 | La interfaz obtiene los permisos del usuario con `my_permissions()` y oculta lo que no puede hacer |
| BO-012 | Un código de permiso inexistente deniega el acceso a todos, también al `ADMIN` (así un error tipográfico no abre nada) |

---

# 4. Auditoría

| ID | Requisito |
| -- | --------- |
| BO-020 | Toda inserción, modificación o borrado en tablas de negocio genera una fila en `audit_log` |
| BO-021 | Cada fila guarda: cuándo, quién (y su rol en ese momento), acción, entidad, id y cambios |
| BO-022 | En modificaciones solo se guardan los campos que cambiaron, con valor anterior y nuevo |
| BO-023 | Las acciones de moderación pueden adjuntar un motivo (`reason`) |
| BO-024 | La auditoría no se puede editar ni borrar desde la API |
| BO-025 | Solo quien tenga `audit.view` puede consultarla |
| BO-026 | Acciones del sistema (sin usuario: SQL Editor, Edge Functions, tareas programadas) quedan con `actor_id` vacío |

Tablas auditadas: `jobs`, `job_skills`, `companies`, `profiles`, `categories`, `skills`, `locations`, `sources`, `reports`, `role_permissions`, `app_settings`, `internal_notes`.

---

# 5. Estados de las ofertas

Las transiciones válidas viven en la tabla `job_status_transitions`; la interfaz las lee de ahí para no ofrecer cambios imposibles. Amplían el diagrama del SRS (6.5) con los caminos de vuelta que el día a día necesita: corregir una oferta rechazada, reabrir una cerrada o republicar una caducada.

| Desde | Puede pasar a |
| ----- | ------------- |
| `DRAFT` | `PENDING_REVIEW`, `ACTIVE`, `REJECTED` |
| `PENDING_REVIEW` | `ACTIVE`, `REJECTED`, `DRAFT` |
| `ACTIVE` | `CLOSED`, `EXPIRED`, `REJECTED` |
| `EXPIRED` | `ACTIVE`, `CLOSED` |
| `CLOSED` | `ACTIVE` |
| `REJECTED` | `DRAFT`, `PENDING_REVIEW` |

| ID | Requisito |
| -- | --------- |
| BO-030 | Una oferta nueva solo puede nacer como `DRAFT`, `PENDING_REVIEW` o `ACTIVE` |
| BO-031 | Un cambio de estado fuera de la tabla se rechaza con un mensaje en español |
| BO-032 | Al pasar a `ACTIVE`, `publication_date` se fija a la fecha del día |
| BO-033 | Cambiar el estado exige `jobs.publish`; cambiar la verificación, `jobs.verify`; el resto del contenido, `jobs.edit` |
| BO-034 | `verified_at` y `verified_by` los rellena la base de datos al verificar; no se pueden escribir a mano (RF-121) |

---

# 6. Configuración

Tabla `app_settings` (clave → valor JSON). Las claves las crean las migraciones; el backoffice solo cambia valores.

| Clave | Valor inicial | Pública | Para qué |
| ----- | ------------- | :-----: | -------- |
| `features.company_portal` | `false` | ✅ | Abre el registro y panel de empresas (Etapa C) |
| `features.job_alerts` | `false` | ✅ | Activa las alertas de ofertas (Etapa D) |
| `features.telegram_channel` | `false` | | Publica ofertas aprobadas en Telegram (Etapa D) |
| `jobs.expiry_days` | `30` | | Días hasta caducar una oferta publicada sin fecha límite |
| `moderation.company_jobs_require_review` | `true` | ✅ | Las ofertas de empresas entran como `PENDING_REVIEW` |
| `companies.max_per_user` | `1` | | Empresas que puede crear una misma persona |

| ID | Requisito |
| -- | --------- |
| BO-040 | Las claves públicas las puede leer cualquiera (el frontend decide qué mostrar) |
| BO-041 | Las no públicas solo las lee el equipo |
| BO-042 | Cambiar un valor exige `settings.edit` y queda auditado |

---

# 7. Módulos y etapas

| Módulo | Contenido | Etapa |
| ------ | --------- | :---: |
| Resumen | KPIs y "pendiente hoy" | B |
| Moderación | Bandeja única: ofertas, empresas por verificar, reportes | B |
| Ofertas | Listado, filtros, edición, historial de cambios | A (reglas) · B (historial) |
| Empresas | Ficha: datos, verificación, ofertas, notas internas (miembros en C, pagos en E) | B |
| Usuarios | Buscar, cambiar rol, suspender, actividad | B |
| Auditoría | Registro filtrable | B |
| Roles y permisos | Matriz editable por el `ADMIN` | B |
| Configuración | Valores de `app_settings` | B |
| Portal de empresa | Registro, equipo, publicar ofertas | C |
| Difusión | Telegram y alertas: enviadas, fallidas, reintentar | D |
| Ingresos | Destacados, sellos, packs, pagos manuales | E |
| Catálogos | Áreas, skills, ubicaciones, fuentes | B |

## 7.1 Etapa A: cimientos

- [x] Roles `USER`, `MODERATOR`, `ADMIN` y reglas BO-001 a BO-007
- [x] Catálogo de permisos, matriz por rol, `has_permission()` y `my_permissions()`
- [x] Políticas RLS reescritas con permisos en lugar de `is_admin()`
- [x] Auditoría automática (BO-020 a BO-026)
- [x] Transiciones de estado de ofertas (BO-030 a BO-034)
- [x] Tabla de configuración con valores iniciales (BO-040 a BO-042)
- [x] Frontend: acceso al panel para moderadores y acciones según permisos

## 7.2 Etapa B: control

- [x] Bandeja de moderación con tres pestañas según permisos (BO-050 a BO-064)
- [x] Verificación de empresas y borrado protegido (BO-052 a BO-054)
- [x] Reportes de usuarios desde la ficha de la oferta, con resolución obligatoria
- [x] Notas internas en fichas de empresa y usuario (BO-070 a BO-072)
- [x] Usuarios: búsqueda, ficha, cambio de rol y suspensión con bloqueo real en Auth (BO-080 a BO-083)
- [x] Historial por ficha y auditoría completa con filtros (BO-090, BO-091)
- [x] Matriz de permisos, configuración y catálogos editables
- [x] Resumen con "pendiente hoy"

---

# 8. Etapa B: requisitos

## 8.1 Moderación de ofertas

| ID | Requisito |
| -- | --------- |
| BO-050 | La bandeja muestra las ofertas en `PENDING_REVIEW`, la más antigua primero |
| BO-051 | Publicar admite una nota opcional; rechazar exige motivo. Ambos quedan en la auditoría (función `moderate_job`) |

## 8.2 Empresas

| ID | Requisito |
| -- | --------- |
| BO-052 | Verificar, rechazar o quitar la verificación exige `companies.verify`; rechazar y quitar exigen motivo (función `review_company`) |
| BO-053 | `verified_at` y `verified_by` los escribe la base de datos |
| BO-054 | Una empresa con ofertas no se puede borrar: se desactiva |

Estados de verificación: `UNVERIFIED` (creada por el equipo), `PENDING` (pidió verificación; en la bandeja), `VERIFIED`, `REJECTED`.

## 8.3 Reportes

| ID | Requisito |
| -- | --------- |
| BO-060 | Un usuario con sesión reporta una oferta publicada; el reporte nace abierto aunque el cliente intente otra cosa |
| BO-061 | Un usuario no puede tener dos reportes abiertos sobre la misma oferta |
| BO-062 | Lo que escribió quien reporta no se puede modificar |
| BO-063 | Resolver o descartar exige una nota de resolución (función `resolve_report`) |
| BO-064 | Al dar un reporte por válido se puede marcar la oferta como reportada o cerrarla, en la misma operación |

## 8.4 Notas internas

| ID | Requisito |
| -- | --------- |
| BO-070 | El equipo puede añadir notas a fichas de oferta, empresa y usuario |
| BO-071 | Las notas solo las ve el equipo; nunca la empresa ni el usuario |
| BO-072 | Cada quien borra sus notas; el administrador, cualquiera. Crear y borrar queda auditado |

## 8.5 Usuarios

| ID | Requisito |
| -- | --------- |
| BO-080 | Cambiar un rol exige motivo (función `set_user_role`); se siguen aplicando BO-001 a BO-004 |
| BO-081 | Suspender exige motivo y bloquea el inicio de sesión en Supabase Auth. Lo hace la Edge Function `manage-user`: primero la base de datos (permiso, reglas, auditoría) y después Auth; si Auth falla, se deshace el cambio |
| BO-082 | El listado permite buscar por nombre o email y filtrar por rol y estado, con fecha de último acceso |
| BO-083 | La ficha muestra acceso (alta, último acceso, email confirmado) y actividad (guardadas, postulaciones, reportes) |
| BO-084 | Si una persona suspendida tenía la sesión abierta, la aplicación la cierra al detectar el perfil suspendido |

## 8.6 Historial y auditoría

| ID | Requisito |
| -- | --------- |
| BO-090 | Cada ficha muestra su historial a quien puede ver la ficha, aunque no tenga `audit.view` (función `entity_history`) |
| BO-091 | La auditoría completa se filtra por tipo de registro, acción, persona y fechas, con paginación (función `audit_search`) |

## 8.7 Pruebas realizadas

Probado contra el proyecto real con cuentas temporales de administrador, moderadora y usuario, borradas después junto con sus datos y su rastro en la auditoría:

1. El usuario reporta una oferta publicada; un segundo reporte igual se rechaza.
2. La moderadora ve los pendientes en el Resumen, publica la oferta en revisión, da el reporte por válido cerrando la oferta (sin nota no le deja) y verifica la empresa.
3. La moderadora no ve Auditoría, Roles ni Configuración, ni el botón de borrar empresa.
4. El administrador suspende al usuario: Auth lo bloquea y el login muestra "Tu cuenta está suspendida". Después lo reactiva.
5. La auditoría refleja cada paso con autor, rol y motivo.

## 7.3 Etapa C: portal de empresas

- [x] Alta de empresa desde el portal, con su equipo (BO-100 a BO-105)
- [x] La empresa edita su ficha y pide verificación (BO-110 a BO-112)
- [x] La empresa prepara ofertas, las envía a revisión y ve el motivo del rechazo (BO-120 a BO-126)
- [x] Sello de empresa verificada en el listado y en el detalle (BO-130)
- [x] El equipo de IAFAM gestiona el equipo de cada empresa desde su ficha

---

# 9. Etapa C: requisitos

## 9.1 Alta y equipo

| ID | Requisito |
| -- | --------- |
| BO-100 | El portal solo funciona con `features.company_portal` activado; si se apaga, nadie de una empresa puede crear ni editar nada |
| BO-101 | Cualquier persona registrada crea su empresa desde `/empresa` (función `create_company_account`) |
| BO-102 | La empresa nace **pendiente de verificación** y aparece en la bandeja de moderación |
| BO-103 | Quien la crea queda como administradora; el límite de empresas por persona es `companies.max_per_user` y el nombre no puede repetirse |
| BO-104 | Quien administra añade a su equipo por email, entre cuentas ya registradas y activas |
| BO-105 | Una empresa siempre conserva al menos una persona administradora; cualquiera puede salirse |

## 9.2 Ficha de la empresa

| ID | Requisito |
| -- | --------- |
| BO-110 | La empresa puede pedir la verificación si está sin verificar o rechazada; concederla o denegarla es solo del equipo de IAFAM |
| BO-111 | La empresa solo edita nombre, web, logo y descripción. Activar, desactivar o cambiar el identificador es del equipo |
| BO-112 | Si una empresa **verificada** cambia de nombre o de web, su verificación vuelve a revisión |

## 9.3 Ofertas de la empresa

| ID | Requisito |
| -- | --------- |
| BO-120 | El equipo de una empresa crea ofertas de **su** empresa y no puede moverlas a otra |
| BO-121 | Solo puede hacer los cambios de estado marcados en `job_status_transitions.company_allowed` |
| BO-122 | No puede publicar por su cuenta mientras `moderation.company_jobs_require_review` esté activo; sin esa exigencia, solo si la empresa está verificada |
| BO-123 | Para enviar una oferta a revisión, su empresa debe estar pendiente o verificada; una empresa rechazada o desactivada no publica |
| BO-124 | Editar una oferta publicada (contenido o tecnologías) la devuelve a revisión y deja de estar visible |
| BO-125 | La empresa solo borra borradores; lo publicado se cierra, no se borra |
| BO-126 | Al rechazar una oferta, el motivo se guarda en `jobs.review_note` y la empresa lo ve en su portal (igual con `companies.review_note`) |

## 9.4 Cara pública

| ID | Requisito |
| -- | --------- |
| BO-130 | Las ofertas de empresas verificadas muestran el sello "Empresa verificada" en el listado y en el detalle |

## 9.5 Pruebas realizadas

Reglas: 23 comprobaciones con roles simulados, en una transacción que se deshace (portal cerrado, alta, límite por persona, nombre duplicado, publicar sin permiso, verificar sin permiso, equipo sin administradora, ajenos sin acceso, rechazo con motivo, reenvío, edición de publicada, renombrar verificada, borrar solo borradores y cascadas al borrar perfiles).

Recorrido completo en el navegador contra el proyecto real, con cuentas temporales borradas después: alta de empresa → oferta a revisión → rechazo con motivo → la empresa ve el motivo, corrige y reenvía → publicación → verificación de la empresa → sello visible en el listado público → editar la publicada la devuelve a revisión → alta de una compañera, que entra y ve la empresa pero no puede gestionar el equipo.
