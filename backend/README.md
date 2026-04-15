# FlowBoard Backend

## Prerequisites

- Java 21 (or compatible)
- Maven 3.8+
- PostgreSQL 16.1
- Docker (optional, for running PostgreSQL)

## Database Setup

### Option 1: Docker (Recommended)

```bash
docker run --name flowboard-postgres \
  -e POSTGRES_USER=flowboard \
  -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=flowboard \
  -p 127.0.0.1:5432:5432 \
  -d postgres:16
```

### Option 2: Manual PostgreSQL Setup

```bash
# Create database and user
createdb flowboard
createuser flowboard
psql flowboard -c "ALTER USER flowboard WITH PASSWORD 'change-me';"
```

## Building

```bash
cd backend
mvn clean install
```

## Lambda Packaging

Build a Lambda-friendly jar for AWS API Gateway + Lambda proxy integration:

```bash
cd backend
mvn -Plambda clean package
zip -j flowboard-backend-lambda.zip target/flowboard-backend-1.0.0.jar
```

Use `com.flowboard.lambda.StreamLambdaHandler` as the Lambda handler in the AWS console.

## Running

```bash
# Run the application
mvn spring-boot:run

# Or use java directly
java -jar target/flowboard-backend-1.0.0.jar
```

The backend will start on `http://localhost:8080/api/v1`

### Profile and Secret Handling

- Local development: use `SPRING_PROFILES_ACTIVE=dev`.
- Production-like runs: use `SPRING_PROFILES_ACTIVE=prod`.
- In `prod` profile, secrets are fail-fast required via environment variables (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`).

## API Documentation

- **Auth Endpoints**
  - `POST /auth/register` - Register a new user
  - `POST /auth/login` - Login and get JWT token

- **Project Endpoints**
  - `POST /projects` - Create a new project (requires auth)
  - `GET /projects` - Get user's projects (requires auth)
  - `GET /projects/{projectId}` - Get project details
  - `DELETE /projects/{projectId}` - Delete project

- **Board Endpoints**
  - `POST /boards/{boardId}/stages` - Add stage to board
  - `PUT /boards/stages/{stageId}` - Update stage
  - `DELETE /boards/stages/{stageId}` - Delete stage
  - `POST /boards/stages/{stageId}/cards` - Create card
  - `PUT /boards/cards/{cardId}` - Update card
  - `PUT /boards/cards/{cardId}/move` - Move card to another stage
  - `DELETE /boards/cards/{cardId}` - Delete card

## Configuration

Configure backend values with environment variables.

Recommended: copy `.env.example` from the repository root and set secure values for:
- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET` (minimum 32 chars)
- `CORS_ALLOWED_ORIGINS`
- `APP_LOG_LEVEL`, `SECURITY_LOG_LEVEL`
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_SECONDS`

## Testing

```bash
mvn test
```

### 10-User Concurrency Smoke Test

```bash
bash scripts/concurrency_10_users_smoke.sh
```

See `../docs/P4_BACKEND_CONCURRENCY_VERIFICATION.md` for full verification steps.

## Troubleshooting

### Database Connection Failed
- Ensure PostgreSQL is running
- Check credentials in `application.yml`
- Verify database exists

### Port Already in Use
- Change `server.port` in `application.yml`
- Or kill process on port 8080: `lsof -ti:8080 | xargs kill`
