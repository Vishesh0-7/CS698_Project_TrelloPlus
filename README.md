# TrelloPlus - AI-Powered Workflow Management

TrelloPlus is an intelligent, team-focused project management app with:
- AI-generated Kanban boards from project descriptions
- Real-time collaborative board updates
- Meeting transcript analysis with AI summaries
- Change review and approval workflows

## Features

- AI board generation (stages and starter tasks)
- Drag-and-drop Kanban board management
- Team project collaboration with role-based access
- Meeting summaries, action items, and decisions
- Change voting and controlled board updates
- Accessibility-first UI (WCAG 2.1 AA targets)

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand
- React Router
- React DnD
- STOMP + SockJS for real-time updates

### Backend
- Spring Boot 3 (Java 21)
- Spring Security (JWT)
- Spring Data JPA + Hibernate
- WebSocket (STOMP)
- PostgreSQL + Flyway

## Project Structure

```text
src/
  app/
    components/
    hooks/
    pages/
    services/
    store/
backend/
  src/main/java/com/flowboard/
  src/main/resources/
  src/test/java/com/flowboard/
docs/
scripts/
```

## Run the App Locally (For Web Users)

These steps are for someone who forks/clones the repo and wants to run the full application in a browser.

### 1. Prerequisites

Install:
- Git
- Node.js 18+
- npm
- Java 21 (JDK)
- Maven 3.8+
- Docker Desktop or Docker Engine (recommended for PostgreSQL)

### 2. Fork and clone

```bash
git clone https://github.com/<your-username>/CS698_Project_TrelloPlus.git
cd CS698_Project_TrelloPlus
```

### 3. Create environment file

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:
- `DB_URL=jdbc:postgresql://localhost:5432/flowboard`
- `DB_USERNAME=flowboard`
- `DB_PASSWORD=change-me`
- `JWT_SECRET=<a-random-secret-at-least-32-characters>`
- `CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`

### 4. Start PostgreSQL

```bash
docker compose -f docker-compose.db.yml up -d
```

### 5. Start backend (Spring Boot)

From project root:

```bash
cd backend
set -a && source ../.env && set +a
mvn spring-boot:run
```

Backend runs at `http://localhost:8080/api/v1`.

### 6. Start frontend (Vite)

Open another terminal from project root:

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### 7. Use the app

- Open `http://localhost:5173`
- Register a new account
- Create a project and board
- Add cards, move cards, and test real-time updates

## Local Testing

### Frontend

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Backend

```bash
cd backend
mvn test
mvn clean test jacoco:report
```

## AWS Deployment Guide (For People Who Fork This Repo)

This section provides a full deployment path on AWS for a forked repository.

### Deployment architecture (recommended)

- EC2 (Ubuntu): runs backend service + Nginx
- RDS PostgreSQL: managed database
- Route 53 (optional): custom domain
- TLS: Certbot/Let's Encrypt on EC2

This repo currently hardcodes API/WS localhost URLs in frontend files. You must update them for production before building frontend assets.

### 0. AWS account setup prerequisites

1. Create an AWS account.
2. Create an IAM user with programmatic access.
3. Install and configure AWS CLI locally:

```bash
aws configure
```

4. Choose one AWS region and use it consistently (example: `us-east-1`).

### 1. Create network and security groups

1. Use default VPC/subnets (or your own VPC).
2. Create security group `trelloplus-ec2-sg`:
- Inbound 22 from your IP only
- Inbound 80 from `0.0.0.0/0`
- Inbound 443 from `0.0.0.0/0`
3. Create security group `trelloplus-rds-sg`:
- Inbound 5432 from `trelloplus-ec2-sg` only

### 2. Create RDS PostgreSQL

1. AWS Console -> RDS -> Create database.
2. Engine: PostgreSQL 16.
3. DB instance class: start with `db.t4g.micro` (or larger for production).
4. Set:
- DB name: `flowboard`
- Master username/password: choose secure values
5. Attach `trelloplus-rds-sg` security group.
6. Keep Public Access = `No`.
7. After creation, copy the RDS endpoint.

### 3. Launch EC2 instance

1. Launch Ubuntu 22.04/24.04 instance.
2. Instance size: at least `t3.medium`.
3. Attach `trelloplus-ec2-sg`.
4. Create/select an SSH key pair.
5. Allocate and attach an Elastic IP.

SSH into EC2:

```bash
ssh -i <your-key.pem> ubuntu@<ec2-elastic-ip>
```

### 4. Install runtime dependencies on EC2

```bash
sudo apt update
sudo apt install -y git nginx maven openjdk-21-jdk nodejs npm
java -version
mvn -version
node -v
```

### 5. Clone your fork on EC2

```bash
cd /opt
sudo git clone https://github.com/<your-username>/CS698_Project_TrelloPlus trelloplus
sudo chown -R ubuntu:ubuntu /opt/trelloplus
cd /opt/trelloplus
```

### 6. Configure backend production environment

Create backend env file:

```bash
cat > /opt/trelloplus/backend/.env.production <<'EOF'
SPRING_PROFILES_ACTIVE=prod
DB_URL=jdbc:postgresql://<rds-endpoint>:5432/flowboard
DB_USERNAME=<rds-username>
DB_PASSWORD=<rds-password>
JWT_SECRET=<random-32-char-or-longer-secret>
CORS_ALLOWED_ORIGINS=https://<your-domain-or-ec2-public-host>
APP_LOG_LEVEL=INFO
SECURITY_LOG_LEVEL=WARN
OLLAMA_BASE_URL=http://<reachable-ollama-host>:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_TIMEOUT_SECONDS=30
EOF
```

Important AI note:
- AI features require a reachable Ollama endpoint.
- If `OLLAMA_BASE_URL` is unreachable, AI generation APIs will return errors.

### 7. Build and run backend as a systemd service

Build jar:

```bash
cd /opt/trelloplus/backend
mvn clean package -DskipTests
```

Create service file:

```bash
sudo tee /etc/systemd/system/trelloplus-backend.service > /dev/null <<'EOF'
[Unit]
Description=TrelloPlus Spring Boot Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/trelloplus/backend
EnvironmentFile=/opt/trelloplus/backend/.env.production
ExecStart=/usr/bin/java -jar /opt/trelloplus/backend/target/flowboard-backend-1.0.0.jar
SuccessExitStatus=143
Restart=always
RestartSec=5
User=ubuntu

[Install]
WantedBy=multi-user.target
EOF
```

Start service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable trelloplus-backend
sudo systemctl start trelloplus-backend
sudo systemctl status trelloplus-backend
```

### 8. Update frontend API and WebSocket endpoints for production

This repository currently hardcodes localhost endpoints in frontend code.
Before building frontend for AWS, update:

- `src/app/services/api.ts`
- `src/app/hooks/useWebSocketBoardUpdates.ts`
- `src/app/hooks/useWebSocketProjectUpdates.ts`

Set them to your production host, for example:
- API base URL: `https://<your-domain>/api/v1`
- WS endpoint: `https://<your-domain>/api/v1/ws/board`

Then build frontend:

```bash
cd /opt/trelloplus
npm install
npm run build
```

### 9. Serve frontend and reverse proxy backend with Nginx

Create Nginx site:

```bash
sudo tee /etc/nginx/sites-available/trelloplus > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    root /opt/trelloplus/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/v1/ws/board {
        proxy_pass http://127.0.0.1:8080/api/v1/ws/board;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/v1/ {
        proxy_pass http://127.0.0.1:8080/api/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

Enable and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/trelloplus /etc/nginx/sites-enabled/trelloplus
sudo nginx -t
sudo systemctl restart nginx
```

At this point the app is reachable at `http://<ec2-elastic-ip>`.

### 10. Add domain and HTTPS (recommended)

1. In Route 53, create hosted zone for your domain.
2. Add `A` record pointing to EC2 Elastic IP.
3. Install Certbot on EC2:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <your-domain>
```

4. Confirm auto-renewal:

```bash
sudo systemctl status certbot.timer
```

5. Update `CORS_ALLOWED_ORIGINS` in `/opt/trelloplus/backend/.env.production` to your HTTPS domain and restart backend:

```bash
sudo systemctl restart trelloplus-backend
```

### 11. Verify deployment

Run checks:

```bash
curl -I https://<your-domain>
curl -I https://<your-domain>/api/v1/auth/login
sudo systemctl status trelloplus-backend
sudo systemctl status nginx
```

In browser:
- Register/login works
- Board CRUD works
- Drag-drop updates persist
- Real-time updates work in two tabs
- Meeting summary and AI flows work (if Ollama endpoint is reachable)

## Common Deployment Pitfalls

- Frontend still pointing to localhost: update API/WS constants before `npm run build`.
- CORS blocked: ensure `CORS_ALLOWED_ORIGINS` exactly matches your frontend origin.
- WebSocket fails behind Nginx: confirm `Upgrade` and `Connection` headers in Nginx config.
- Backend cannot connect to DB: verify RDS SG allows 5432 from EC2 SG.
- AI features fail: check `OLLAMA_BASE_URL` reachability and model availability.

## Useful Commands

### Frontend

```bash
npm run dev
npm run build
npm test
npm run test:coverage
```

### Backend

```bash
cd backend
mvn spring-boot:run
mvn test
```

## Documentation

- `SETUP_GUIDE.md`
- `docs/dev_spec_1.md`
- `docs/dev_spec_2.md`
- `docs/dev_spec_3.md`
- `ACCESSIBILITY_COMPLIANCE.md`
- `ATTRIBUTIONS.md`

## Team
- Swechcha Ambati
- Luke Hill
- Vishesh Raju

