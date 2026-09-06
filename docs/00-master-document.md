# 📘 DOCUMENTO MAESTRO DEL PROYECTO

# Plataforma inteligente de oportunidades profesionales para el sector informático

**Versión:** 1.0
**Estado:** Diseño inicial
**Tipo:** Aplicación web / plataforma de empleo / sistema de información
**Enfoque:** Software + Data Engineering + Data Science + IA
**Desarrollo:** Iterativo por fases

---

# 1. Nombre del proyecto

### Nombre provisional

**IAFAM Jobs**

### Descripción corta

> Plataforma web destinada a centralizar, organizar, validar y analizar oportunidades laborales dirigidas principalmente a estudiantes, recién graduados y profesionales del sector informático.

### Posible eslogan

> **Todas tus oportunidades. En un solo lugar.**

No considero el nombre definitivo todavía. Primero debemos desarrollar el producto y posteriormente decidir si IAFAM Jobs es realmente el mejor nombre.

---

# 2. Problema que queremos resolver

Actualmente, los estudiantes y graduados del sector informático encuentran oportunidades laborales distribuidas en múltiples fuentes:

* Redes profesionales.
* Sitios web de empresas.
* Bolsas de empleo.
* Redes sociales.
* Grupos de mensajería.
* Comunidades universitarias.
* Profesores.
* Contactos personales.
* Eventos.
* Ofertas obtenidas presencialmente.

Esto genera varios problemas:

### 2.1 Dispersión

Las oportunidades están repartidas entre múltiples plataformas.

### 2.2 Pérdida de oportunidades

Una persona puede no enterarse de una oferta simplemente porque no consultó determinada fuente.

### 2.3 Información desorganizada

Las ofertas suelen presentar información con estructuras diferentes.

### 2.4 Ofertas duplicadas

Una misma vacante puede aparecer en múltiples fuentes.

### 2.5 Ofertas desactualizadas

Una oferta puede continuar circulando aunque el proceso de selección ya haya terminado.

### 2.6 Dificultad para buscar

Encontrar una oportunidad concreta puede requerir revisar manualmente muchas páginas.

### 2.7 Falta de información sobre el mercado

Los estudiantes normalmente no tienen una visión clara de:

* qué tecnologías se solicitan;
* qué puestos están creciendo;
* qué habilidades son más demandadas;
* qué experiencia solicitan las empresas;
* qué modalidades de trabajo existen.

---

# 3. Problema central

Podemos resumirlo así:

> **La información sobre oportunidades profesionales del sector informático se encuentra fragmentada, desestructurada y frecuentemente desactualizada, dificultando que estudiantes y profesionales encuentren oportunidades adecuadas y comprendan las habilidades que demanda el mercado.**

---

# 4. Solución propuesta

Construir una plataforma web que permita:

> **recopilar, centralizar, estructurar, clasificar, verificar, buscar y analizar oportunidades profesionales provenientes de diferentes fuentes.**

La plataforma permitirá que las ofertas puedan incorporarse mediante:

### Fuente A — Registro manual

Un administrador introduce una oferta encontrada:

* presencialmente;
* por contacto;
* en una empresa;
* en una universidad;
* en una comunidad.

### Fuente B — Importación

Mediante mecanismos autorizados como:

* APIs;
* RSS;
* feeds;
* archivos;
* integraciones.

### Fuente C — Automatización

Posteriormente podremos implementar sistemas capaces de procesar automáticamente determinadas fuentes compatibles.

---

# 5. Objetivo general

> **Diseñar e implementar una plataforma web inteligente capaz de centralizar y gestionar oportunidades profesionales del sector informático, proporcionando mecanismos de búsqueda, clasificación, validación, personalización y análisis de la información laboral.**

---

# 6. Objetivos específicos

### OE1

Diseñar una base de datos estructurada para almacenar ofertas laborales.

### OE2

Desarrollar un sistema de usuarios y autenticación.

### OE3

Implementar mecanismos de incorporación manual de ofertas.

### OE4

Implementar búsqueda y filtrado avanzado.

### OE5

Implementar categorización de oportunidades.

### OE6

Implementar mecanismos de validación.

### OE7

Detectar y gestionar ofertas duplicadas.

### OE8

Gestionar automáticamente el estado de las ofertas.

### OE9

Permitir a los usuarios guardar y gestionar oportunidades.

### OE10

Implementar un sistema de alertas.

### OE11

Desarrollar mecanismos de recomendación basados en el perfil del usuario.

### OE12

Implementar procesamiento automático del texto de las ofertas.

### OE13

Extraer información relevante mediante técnicas de NLP.

### OE14

Generar estadísticas sobre el mercado laboral tecnológico.

---

# 7. Usuarios objetivo

La plataforma tendrá inicialmente tres tipos principales.

## 👨‍🎓 Usuario 1 — Estudiante

Busca:

* prácticas;
* pasantías;
* trabajos junior;
* oportunidades de formación;
* primeros empleos.

---

## 👨‍💻 Usuario 2 — Graduado / profesional

Busca:

* empleo;
* cambio de trabajo;
* oportunidades remotas;
* puestos especializados;
* crecimiento profesional.

---

## 👨‍💼 Usuario 3 — Administrador

Gestiona:

* ofertas;
* empresas;
* fuentes;
* categorías;
* usuarios;
* validaciones;
* reportes.

---

# 8. Áreas profesionales

La plataforma no debe limitarse inicialmente a "programadores".

Podremos manejar categorías como:

### Desarrollo

* Frontend
* Backend
* Full Stack
* Mobile
* Software Engineer

### Datos

* Data Analyst
* Data Scientist
* Data Engineer
* Business Intelligence
* Machine Learning

### Calidad

* QA
* QA Automation
* Software Testing

### Diseño

* UI
* UX
* Graphic Design
* Product Design

### Infraestructura

* DevOps
* Cloud
* SysAdmin
* SRE

### Seguridad

* Cybersecurity
* Security Analyst

### Inteligencia Artificial

* AI Engineer
* ML Engineer
* NLP
* Computer Vision

### Bioinformática

* Bioinformatics
* Computational Biology
* Genomics
* Data Analysis

Esto último puede ser especialmente interesante para diferenciar la plataforma de una bolsa de empleo genérica.

---

# 9. Arquitectura conceptual

La plataforma tendrá inicialmente cuatro grandes bloques:

```text
                  ┌───────────────────┐
                  │      USUARIOS     │
                  └─────────┬─────────┘
                            │
                            ↓
                  ┌───────────────────┐
                  │     FRONTEND      │
                  │      React        │
                  └─────────┬─────────┘
                            │
                          REST
                            │
                            ↓
                  ┌───────────────────┐
                  │      BACKEND      │
                  │      Flask        │
                  └─────────┬─────────┘
                            │
                  ┌─────────┼─────────┐
                  ↓         ↓         ↓
             PostgreSQL   Redis    Workers
```

Posteriormente:

```text
              FUENTES EXTERNAS
                     │
                     ↓
               INGESTIÓN
                     │
                     ↓
                RabbitMQ
                     │
                     ↓
                WORKERS
                     │
          ┌──────────┼──────────┐
          ↓          ↓          ↓
       limpieza  clasificación  dedup.
          │          │          │
          └──────────┼──────────┘
                     ↓
                PostgreSQL
```

---

# 10. Arquitectura tecnológica

## Frontend

**React**

Responsabilidades:

* interfaz;
* navegación;
* filtros;
* formularios;
* autenticación;
* dashboards;
* comunicación con API.

---

## Backend

**Python + Flask**

Responsabilidades:

* lógica de negocio;
* autenticación;
* API REST;
* validación;
* gestión de ofertas;
* usuarios;
* empresas;
* fuentes;
* favoritos;
* alertas.

---

## Base de datos

**PostgreSQL**

Será el sistema principal de almacenamiento.

---

## Cache

**Redis**

Para:

* sesiones;
* cache;
* tareas rápidas;
* posteriormente rate limiting.

---

## Procesamiento asíncrono

**RabbitMQ**

Permitirá desacoplar:

```text
API
 ↓
cola
 ↓
worker
 ↓
procesamiento
```

---

## Automatización

**n8n**

Podrá utilizarse posteriormente para:

* workflows;
* notificaciones;
* integraciones;
* automatizaciones;
* procesamiento de eventos.

---

## Contenedores

**Docker**

Cada componente podrá ejecutarse independientemente.

---

# 11. Modelo conceptual de datos

Las entidades principales serán:

```text
USER
COMPANY
JOB
CATEGORY
SKILL
LOCATION
SOURCE
JOB_SOURCE
JOB_SKILL
APPLICATION
FAVORITE
ALERT
REPORT
```

Relación conceptual:

```text
USER
 │
 ├──────── FAVORITE ─────── JOB
 │
 ├──────── APPLICATION ──── JOB
 │
 └──────── ALERT


JOB
 │
 ├──── COMPANY
 │
 ├──── CATEGORY
 │
 ├──── LOCATION
 │
 ├──── SKILLS
 │
 └──── SOURCES
```

---

# 12. Entidad JOB

Cada oferta tendrá información estructurada.

```text
id
title
description
company_id
category_id
location_id
employment_type
work_mode
experience_level
salary_min
salary_max
currency
publication_date
deadline
status
verification_status
created_at
updated_at
```

Pero además podremos conservar el contenido original:

```text
original_text
original_url
source_id
```

Esto será muy importante para futuras técnicas de NLP.

---

# 13. Estado de una oferta

Utilizaremos estados controlados:

```text
DRAFT
PENDING_REVIEW
ACTIVE
EXPIRED
CLOSED
REJECTED
```

Ejemplo:

```text
Nueva oferta
     ↓
DRAFT
     ↓
PENDING_REVIEW
     ↓
ACTIVE
     ↓
EXPIRED
```

---

# 14. Sistema de verificación

Cada oferta tendrá:

```text
verification_status
```

Posibles valores:

🟢 VERIFIED
🟡 PENDING
🔴 REPORTED

Además:

```text
verified_at
verified_by
```

Esto permitirá conocer quién y cuándo verificó una oferta.

---

# 15. Sistema de duplicados

Antes de insertar una oferta podremos calcular una similitud utilizando elementos como:

* empresa;
* título;
* ubicación;
* descripción;
* URL;
* tecnologías;
* fecha.

Ejemplo:

```text
Oferta A
Python Developer — Empresa X

Oferta B
Junior Python Developer — Empresa X

Similarity = 91%
```

El sistema podría advertir:

> "Posible oferta duplicada."

El administrador decidirá.

---

# 16. Búsqueda

La búsqueda será uno de los componentes centrales.

El usuario podrá buscar:

```text
Python
```

o:

```text
Data Analyst
```

o:

```text
QA Automation
```

---

# 17. Filtros

Los filtros iniciales serán:

### Área

```text
Development
Data
QA
Design
DevOps
AI
Bioinformatics
Cybersecurity
```

### Nivel

```text
Internship
Junior
Mid
Senior
```

### Modalidad

```text
Remote
Hybrid
On-site
```

### Ubicación

```text
País
Ciudad
Región
```

### Tipo

```text
Full-time
Part-time
Internship
Freelance
Contract
```

---

# 18. Perfil profesional

Cada usuario podrá configurar:

```text
Perfil
──────

Carrera

Experiencia

Áreas de interés

Skills

Tecnologías

Ubicación

Modalidad preferida

Nivel profesional
```

Esto permitirá posteriormente desarrollar el sistema de matching.

---

# 19. Matching usuario ↔ oferta

Una evolución importante será calcular:

```text
USER
 ↓
perfil
 ↓
skills
 ↓
preferencias
 ↓
comparación
 ↓
JOB
```

Resultado:

> **91% de compatibilidad**

Por ejemplo:

```text
Python                 ✓
SQL                    ✓
Junior                 ✓
Remote                 ✓
Data Analysis          ✓
Power BI               ✗
```

No será simplemente un "algoritmo mágico"; queremos que el usuario pueda entender **por qué** una oferta es recomendada.

---

# 20. Favoritos

El usuario podrá guardar:

⭐ Oferta

Y visualizar:

```text
Mis oportunidades
──────────────────

⭐ Python Developer
⭐ Data Analyst
⭐ QA Engineer
```

---

# 21. Seguimiento de postulaciones

El usuario podrá registrar:

```text
Oferta
 ↓
Guardada
 ↓
Postulado
 ↓
Entrevista
 ↓
Oferta recibida
```

Estados:

```text
SAVED
APPLIED
INTERVIEW
REJECTED
ACCEPTED
```

Esto convierte la plataforma también en un **gestor personal de búsqueda de empleo**.

---

# 22. Alertas

El usuario podrá definir:

```text
Nueva alerta

Área:
Data Science

Nivel:
Junior

Modalidad:
Remote

Tecnologías:
Python
SQL
```

Cuando aparezca una oferta compatible:

```text
🔔 Nueva oportunidad

Data Analyst Junior

92% compatible
```

---

# 23. Sistema de reportes

Los usuarios podrán reportar:

* oferta falsa;
* oferta duplicada;
* oferta expirada;
* información incorrecta;
* empresa incorrecta;
* enlace roto.

Ejemplo:

```text
REPORT

job_id
user_id
reason
description
status
created_at
```

---

# 24. Panel administrativo

El administrador tendrá:

```text
Dashboard
│
├── Ofertas
├── Empresas
├── Usuarios
├── Categorías
├── Skills
├── Fuentes
├── Reportes
└── Estadísticas
```

---

# 25. Dashboard de ofertas

Ejemplo:

```text
OFERTAS

Total:              1,250
Activas:              420
Pendientes:            18
Expiradas:             812
Reportadas:              7
```

---

# 26. Inteligencia de datos

Cuando tengamos suficiente información podremos analizar:

### Tecnologías más demandadas

```text
Python
SQL
JavaScript
Java
Docker
React
AWS
```

### Puestos más frecuentes

```text
Software Developer
Data Analyst
QA Engineer
Data Scientist
DevOps
```

### Distribución geográfica

```text
País
 ↓
Ciudad
 ↓
ofertas
```

### Evolución temporal

```text
Mes → cantidad de ofertas
```

---

# 27. NLP

Una fase avanzada permitirá analizar automáticamente:

```text
Descripción de oferta
        ↓
       NLP
        ↓
┌─────────────────────┐
│ Python              │
│ SQL                 │
│ Docker              │
│ PostgreSQL          │
│ Junior              │
│ Remote              │
└─────────────────────┘
```

El sistema podrá identificar:

* tecnologías;
* habilidades;
* experiencia;
* idiomas;
* cargos;
* modalidad;
* ubicación;
* requisitos.

---

# 28. Arquitectura futura de procesamiento

```text
             JOB ORIGINAL
                   │
                   ↓
              PREPROCESS
                   │
                   ↓
               NLP ENGINE
                   │
          ┌────────┼─────────┐
          ↓        ↓         ↓
        SKILLS   LEVEL     LOCATION
          │        │         │
          └────────┼─────────┘
                   ↓
              STRUCTURED JOB
```

---

# 29. Observatorio del mercado laboral

Esta será una de las funcionalidades de mayor valor a largo plazo.

La plataforma podrá responder preguntas como:

> ¿Qué tecnologías solicitan más las empresas?

> ¿Qué puestos tienen mayor crecimiento?

> ¿Qué habilidades necesita un Data Analyst junior?

> ¿Qué porcentaje de ofertas permite trabajo remoto?

> ¿Qué categorías tienen más oportunidades?

Esto podría convertirse en un módulo independiente:

# 📊 IAFAM Labor Market Intelligence

---

# 30. MVP

Aquí quiero ser muy estricto.

**El MVP NO tendrá IA, RabbitMQ, Redis, n8n ni scraping complejo.**

El MVP tendrá únicamente:

```text
┌─────────────────────────────┐
│          MVP                │
├─────────────────────────────┤
│ Registro / Login            │
│ Usuarios                    │
│ Crear ofertas               │
│ Listar ofertas              │
│ Ver oferta                  │
│ Buscar                      │
│ Filtrar                     │
│ Categorías                  │
│ Empresas                    │
│ Favoritos                   │
│ Panel administrativo        │
│ Validación básica           │
└─────────────────────────────┘
```

Objetivo:

> **Tener una plataforma funcional antes de añadir complejidad.**

---

# 31. Fase 2 — Plataforma

Añadiremos:

```text
Favoritos avanzados
Postulaciones
Alertas
Reportes
Verificación
Fuentes
Duplicados
Ofertas expiradas
```

---

# 32. Fase 3 — Data Engineering

Aquí entran:

```text
APIs
RSS
ETL
Workers
RabbitMQ
Redis
n8n
procesamiento automático
```

---

# 33. Fase 4 — Inteligencia

Añadiremos:

```text
NLP
extracción de skills
clasificación automática
matching
recomendaciones
```

---

# 34. Fase 5 — Analytics

Finalmente:

```text
Data Warehouse
ETL/ELT
estadísticas
dashboards
Power BI
tendencias
```

---

# 35. Seguridad

Desde el comienzo debemos contemplar:

* contraseñas almacenadas de forma segura;
* autenticación;
* autorización por roles;
* validación de entradas;
* protección de endpoints;
* rate limiting;
* gestión segura de sesiones/tokens;
* variables de entorno;
* secretos fuera del repositorio;
* HTTPS en producción;
* logs;
* copias de seguridad.

---

# 36. Testing

No vamos a esperar al final.

Tendremos:

### Backend

* unit tests;
* integration tests;
* API tests.

### Frontend

* componentes;
* formularios;
* navegación.

### Base de datos

* integridad;
* restricciones;
* relaciones.

### Sistema completo

```text
Frontend
   ↓
API
   ↓
Backend
   ↓
Database
```

---

# 37. GitHub

El repositorio tendrá una estructura profesional.

```text
iafam-jobs/
│
├── frontend/
│
├── backend/
│
├── database/
│
├── docs/
│
├── tests/
│
├── scripts/
│
├── docker/
│
├── .github/
│
├── .gitignore
├── README.md
├── docker-compose.yml
└── LICENSE
```

---

# 38. Documentación

Dentro de `/docs` tendremos:

```text
docs/

01-project/
02-requirements/
03-architecture/
04-database/
05-api/
06-frontend/
07-backend/
08-testing/
09-deployment/
10-data-engineering/
11-ai/
12-analytics/
```

Así el proyecto será reproducible y entendible.

---

# 39. Metodología de desarrollo

Trabajaremos por **sprints cortos**.

Cada sprint tendrá:

```text
PLAN
 ↓
DESARROLLO
 ↓
TEST
 ↓
DOCUMENTACIÓN
 ↓
COMMIT
 ↓
REVIEW
```

No quiero que acumulemos código sin saber qué funciona.

---

# 40. Roadmap inicial

### 🟢 Etapa 0 — Diseño

* requisitos;
* arquitectura;
* modelo de datos;
* UX;
* estructura GitHub.

### 🟢 Etapa 1 — Backend

* Flask;
* PostgreSQL;
* modelos;
* API;
* autenticación.

### 🟢 Etapa 2 — Frontend

* React;
* login;
* dashboard;
* ofertas;
* filtros.

### 🟢 Etapa 3 — MVP

Integración completa:

```text
React
 ↕
Flask API
 ↕
PostgreSQL
```

### 🟡 Etapa 4

* favoritos;
* aplicaciones;
* reportes;
* verificación.

### 🟡 Etapa 5

* fuentes;
* ingestión;
* automatización.

### 🟠 Etapa 6

* RabbitMQ;
* workers;
* Redis.

### 🔴 Etapa 7

* NLP;
* matching;
* recomendaciones.

### 🔵 Etapa 8

* Data Warehouse;
* analytics;
* Power BI;
* observatorio laboral.

---

# 41. Principio fundamental del proyecto

Hay una regla que quiero establecer desde ahora:

> **La complejidad debe aparecer cuando el problema la necesite, no porque la tecnología sea interesante.**

Por eso:

```text
NO:

"Tenemos RabbitMQ porque queremos usar RabbitMQ."

SÍ:

"Tenemos un problema de procesamiento asíncrono,
por lo que RabbitMQ resuelve ese problema."
```

Esto hará que el proyecto tenga una arquitectura defendible.

---

# 42. Métricas de éxito

Podremos medir:

### Plataforma

* usuarios registrados;
* ofertas activas;
* ofertas verificadas;
* empresas registradas;
* fuentes utilizadas.

### Calidad

* porcentaje de ofertas duplicadas;
* porcentaje de ofertas expiradas;
* tiempo promedio de validación.

### Utilidad

* ofertas guardadas;
* postulaciones registradas;
* alertas creadas;
* usuarios recurrentes.

### Datos

* tecnologías detectadas;
* categorías;
* tendencias;
* distribución geográfica.

---

# 43. Visión a largo plazo

La visión final sería:

```text
                    IAFAM JOBS
                        │
        ┌───────────────┼────────────────┐
        ↓               ↓                ↓
   OPORTUNIDADES     USUARIOS          EMPRESAS
        │               │                │
        ↓               ↓                ↓
     DATOS          MATCHING          TALENTO
        │               │                │
        └───────────────┼────────────────┘
                        ↓
                  INTELIGENCIA
                        ↓
                MERCADO LABORAL
```

Y la plataforma podría evolucionar desde:

**"Encuentra trabajo"**

hacia:

> **"Descubre qué oportunidades existen, qué habilidades necesitas y cómo está evolucionando el mercado tecnológico."**

---

# 44. 🧠 Mi recomendación estratégica

Paulo, yo **no intentaría hacer que esto sea exclusivamente para Cuba**.

El problema que estamos resolviendo existe en prácticamente cualquier mercado.

Podemos comenzar con un conjunto pequeño de fuentes y usuarios, pero diseñar la arquitectura para que posteriormente soporte:

```text
Cuba
 ↓
Latinoamérica
 ↓
España
 ↓
Europa
 ↓
Global
```

Y tampoco limitaría la plataforma únicamente a "graduados".

El núcleo podría ser:

> **Estudiantes + recién graduados + profesionales junior del sector tecnológico.**

Después podemos ampliar.

---

# 45. 🎯 Definición oficial del proyecto

Si mañana alguien te pregunta:

> **¿Qué estás desarrollando?**

Yo respondería:

> **IAFAM Jobs es una plataforma web inteligente orientada al mercado laboral tecnológico que centraliza oportunidades profesionales provenientes de diferentes fuentes, las estructura, clasifica y valida, y posteriormente utiliza técnicas de análisis de datos e inteligencia artificial para facilitar la búsqueda personalizada de empleo y generar información sobre las tendencias y habilidades demandadas por el mercado.**

Eso ya describe **un proyecto de ingeniería de software + datos + IA**, no simplemente una página web.

---

## 🔥 Siguiente paso

Ahora **no programemos todavía**.

El siguiente documento que deberíamos construir es el **Documento de Requisitos del Sistema (SRS)**. Ahí vamos a bajar esta idea a tierra y definir, uno por uno:

**qué puede hacer cada usuario → qué pantallas necesitamos → qué botones existen → qué ocurre cuando se pulsa cada botón → qué datos entran → qué datos salen → qué endpoints necesitamos → qué tablas necesitamos.**

Después de eso podemos diseñar el **modelo entidad-relación de PostgreSQL** y recién entonces comenzar con Flask/React.

Ese orden nos va a ahorrar una enorme cantidad de retrabajo.
