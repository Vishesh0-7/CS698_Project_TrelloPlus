# FlowBoard Setup Guide (SRE Runbook)

## Scope

This guide is for operating the backend module and its required storage.

- Backend service: Spring Boot service in backend/
- Data storage: PostgreSQL (single logical database named flowboard)
- Optional client/service components for validation: frontend Vite app, CI runtime, AI provider key

## External Dependencies (Required and Optional)

This section lists every external library, framework, technology, or service the backend module depends on.

### Required runtime dependencies

- Java 21: JVM runtime for the service.
- Maven 3.8 or newer: build and run lifecycle.
- Spring Boot 3.2.x: application framework.
- Spring Web: REST API serving.
- Spring Data JPA and Hibernate: ORM and persistence.
- Spring Security: authn/authz and JWT enforcement.
- Spring Validation: request validation.
- PostgreSQL 16: primary and only persistent datastore.
- PostgreSQL JDBC Driver (org.postgresql:postgresql): DB connectivity.
- Flyway: schema migration management at startup.
- JJWT (jjwt-api, jjwt-impl, jjwt-jackson): JWT token creation/validation.
- Jackson (jackson-datatype-jsr310): JSON serialization, Java time support.
- Apache Commons Lang: utility helpers.

### Build-time and developer-tool dependencies

- Lombok: compile-time code generation annotations.
- Spring Boot Maven Plugin: packaging and app bootstrapping in Maven lifecycle.
- Docker Engine (optional but recommended): local Postgres provisioning.
- Docker Compose (optional): repeatable local database start/stop/reset.

### Optional external services and integrations

- OpenAI API key: optional, only if non-mock AI behavior is enabled.
- GitHub Actions runners and service containers: optional for CI execution.
- Node.js and npm: optional for frontend smoke/E2E style checks; not required for backend boot.

## Database Ownership and Access Model

### What database is used

- Engine: PostgreSQL
- Logical database name: flowboard
- Managed schema migrations: backend/src/main/resources/db/migration

### What this module creates

- Creates and migrates schema objects through Flyway on startup.
- Creates and updates tables for:
  - Authentication and users
  - Projects, boards, stages, cards
  - Meetings, summaries, decisions, action items
  - Change requests and approvals
  - Flyway migration history (flyway_schema_history)

### What this module reads and writes

- Reads from and writes to all FlowBoard domain tables in the flowboard database.
- No second operational datastore is required for core backend behavior.
- Any in-memory state (such as short-window rate-limit buckets) is process-local and reset on service restart.

## Installation and Environment Preparation

### 1) Host prerequisites

- Java 21 installed and on PATH
- Maven installed and on PATH
- PostgreSQL 16 reachable locally or over network
- Optional: Docker and Docker Compose

### 2) Configure environment variables

From repository root:

```bash
cp .env.example .env
```

Set at minimum:

- DB_URL
- DB_USERNAME
- DB_PASSWORD
- JWT_SECRET (minimum 32 bytes, for example generate with `openssl rand -base64 48`)
- CORS_ALLOWED_ORIGINS

For production-like runs also set:

- SPRING_PROFILES_ACTIVE=prod
- BEDROCK_REGION
- BEDROCK_MODEL_ID
- BEDROCK_TIMEOUT_SECONDS
- BEDROCK_MAX_TOKENS

## Startup Procedures

### A) Start data storage (recommended local path)

```bash
docker compose -f docker-compose.db.yml up -d
```

Validate database readiness:

```bash
docker compose -f docker-compose.db.yml ps
```

### B) Start backend service

```bash
cd backend
set -a && source ../.env && set +a
mvn spring-boot:run
```

Default service endpoint:

- http://localhost:8080/api/v1

Health-style reachability check:

```bash
curl -i http://localhost:8080/api/v1/auth/login
```

Expected behavior: method may return 405 for GET, which still confirms listener readiness.

### C) Optional start for frontend validation

From repository root:

```bash
npm install
npm run dev
```

Frontend default URL:

- http://localhost:5173

## Stop Procedures

### Stop backend

- If running in foreground terminal: Ctrl+C
- If running in background shell: terminate the process ID used for startup

### Stop database

```bash
docker compose -f docker-compose.db.yml down
```

## Reset Procedures (Service and Storage)

Choose the smallest blast-radius reset needed.

### Reset backend process state only

Use when rate-limit buckets or other process-local state must be cleared.

1. Stop backend process.
2. Start backend again with the normal startup command.

### Reset database data but keep container

Use when you need a clean schema and data with same running container.

```bash
docker exec -it flowboard-postgres psql -U flowboard -d postgres -c "DROP DATABASE IF EXISTS flowboard;"
docker exec -it flowboard-postgres psql -U flowboard -d postgres -c "CREATE DATABASE flowboard;"
```

Then restart backend so Flyway recreates schema.

### Full storage reset (remove volume)

Use when corruption or unknown local state exists.

```bash
docker compose -f docker-compose.db.yml down -v
docker compose -f docker-compose.db.yml up -d
```

Then restart backend.

## Test-Only Concurrency Profile (SRE Validation)

For high-concurrency test runs only:

- Profile file: backend/src/main/resources/application-concurrency-test.yml
- Activation example:

```bash
cd backend
set -a && source ../.env && set +a
mvn spring-boot:run -Dspring-boot.run.arguments='--server.port=8085 --spring.profiles.active=dev,concurrency-test'
```

Purpose:

- Relaxes auth rate-limit thresholds for automation.
- Should not be used as a default production profile.

## Troubleshooting

### Database authentication failures

- Verify DB_URL, DB_USERNAME, DB_PASSWORD values.
- Confirm the Postgres user/password actually match container or server config.

### Port already in use

- Change server port with runtime argument --server.port.
- Or stop conflicting process bound to the same port.

### Flyway checksum mismatch

- Do not mutate previously applied migrations.
- Run Flyway repair locally if needed, then add a new versioned migration for further changes.

### Frontend API network errors during multi-instance testing

- Ensure CORS_ALLOWED_ORIGINS includes local origins in use.
- Ensure frontend points to the correct backend base URL and port.

## Operational References

- backend/README.md
- docs/P4_BACKEND_CONCURRENCY_VERIFICATION.md
- docs/UNIFIED_BACKEND_ARCHITECTURE.md
- docs/BACKEND_MODULE_SPECIFICATIONS.md
