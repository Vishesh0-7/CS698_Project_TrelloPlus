# Sprint P6: Deployment Plan

## 1. Frontend Deployment
### Objective
Deploy the P3 frontend to AWS Amplify with environment-aware configuration, automated build and deploy through GitHub Actions, and end-to-end connectivity to the deployed API Gateway backend.

### Key Tasks
- Create an AWS Amplify app connected to the GitHub repository and configure branch-based environments for dev, staging, and main.
- Configure Amplify build settings in amplify.yml for install, test, and production build steps.
- Add environment variables in Amplify for API base URL, auth configuration, and runtime flags per environment.
- Implement custom domain mapping and HTTPS verification for staging and production.
- Add a GitHub Actions workflow to run frontend lint and unit tests on pull requests and trigger Amplify deployment only after successful checks.
- Define branch protection rules with required checks, pull request reviews, and blocked direct pushes to main.
- Execute integration smoke tests from GitHub Actions after deployment by validating key frontend user flows against live backend endpoints.

### Deliverables
- Amplify app configured with at least staging and production branches.
- Successful GitHub Actions pipeline for frontend quality gates and deployment trigger.
- Frontend URLs documented with environment mapping and API Gateway endpoint configuration.
- Integration smoke test report attached to CI run artifacts.

### Risks & Mitigations
- Risk: Environment variable mismatch causes frontend-backend connection failures. Mitigation: Use a per-branch environment variable mapping table and validate required variables in CI before deployment.
- Risk: Broken deployment due to dependency or build drift. Mitigation: Pin Node version and lockfile; enforce build-step parity between local and Amplify.
- Risk: Unreviewed changes reach production. Mitigation: Enforce branch protection with required checks and at least one reviewer approval.

## 2. Backend Deployment
### Objective
Deploy the P4 backend as AWS Lambda functions exposed through API Gateway REST API, with automated packaging and deployment via GitHub Actions and post-deploy integration verification.

### Key Tasks
- Package backend components for AWS Lambda runtime compatibility, including handler entrypoint, dependencies, and configuration.
- Provision API Gateway REST API routes mapped to Lambda handlers, including CORS, request and response mapping, and stage configuration for dev and prod.
- Manage infrastructure as code using CloudFormation, SAM, or Terraform for Lambda, API Gateway, IAM roles, and logging.
- Configure CloudWatch logs and metrics plus baseline alarms for 5xx error rate and latency.
- Add a GitHub Actions backend workflow for build, unit test, artifact packaging, and deployment to Lambda and API Gateway using AWS credentials from GitHub Secrets or OIDC.
- Add deployment gates so only merges to the protected branch trigger production deployment, while pull requests deploy to non-production.
- Implement integration testing strategy with API-level tests after deployment for health check, auth flow, critical CRUD path, and error path; fail pipeline on regressions.

### Deliverables
- Deployed Lambda-backed API Gateway REST API with documented endpoints.
- Infrastructure as code definitions committed and reproducible.
- GitHub Actions backend CI/CD workflow with staged deployment behavior.
- Integration test suite integrated into CI with pass and fail reporting.

### Risks & Mitigations
- Risk: IAM misconfiguration blocks API Gateway to Lambda invocation. Mitigation: Use least-privilege templates reviewed in pull requests and run automated post-deploy permission checks.
- Risk: Cold starts or timeout issues degrade user experience. Mitigation: Tune memory and timeout, optimize dependency size, and monitor p95 latency in CloudWatch.
- Risk: Deployment secrets exposure. Mitigation: Use GitHub OIDC or encrypted secrets, rotate credentials, and restrict environment-level access.

## 3. LLM Integration and Deployment
### Objective
Replace all mocked LLM features with a real locally hosted model running on a cloud server, exposed through a secure backend integration path, with automated validation and deployment controls.

### Key Tasks
- Select and benchmark one local model for deployment (for example Llama 3.1 8B or Mistral 7B) based on latency, GPU memory, and output quality for project use cases.
- Provision a cloud inference host on AWS EC2 with GPU support and Dockerized model serving (vLLM or Ollama), restricted to private network access.
- Define backend integration contract so the Lambda backend calls the LLM host through a private endpoint, with request timeouts, retry policy, circuit breaker fallback, and structured error responses.
- Store model host URL and API secrets in AWS Secrets Manager and pass configuration to Lambda through environment variables.
- Add observability: request and response metadata logging, token usage, p95 latency, error rate, and model health checks surfaced in CloudWatch dashboards.
- Implement integration tests for real LLM flow: frontend prompt submission, backend orchestration, model response rendering, and failure-mode handling when model host is unavailable.
- Add GitHub Actions jobs for LLM path verification: schema validation, prompt regression tests, integration tests against staging model endpoint, and deployment gating.
- Apply a verification pipeline for hallucination control using a multi-agent approach: Agent A drafts output, Agent B checks factual and policy constraints against approved sources, Agent C executes deterministic validators and rejects unverifiable outputs.
- Enforce team policy: no direct code edits — only prompt-based modifications, with all generated outputs committed through reviewed pull requests.
- Keep branch protection active with required checks for LLM integration tests, security scan, and reviewer approval before merge to main.

### Deliverables
- Running cloud-hosted local model endpoint connected to backend non-production environment.
- Backend integration module replacing all mocked LLM calls with real inference calls and fallback behavior.
- GitHub Actions workflow that validates and gates LLM-related deployments.
- Integration test suite and report proving frontend to backend to LLM end-to-end behavior.
- LLM safety and verification checklist documenting hallucination prevention, escalation, and rejection criteria.
- Sprint timeline (4 weeks): Week 1 covers model selection, EC2 provisioning, and secure networking; Week 2 covers backend connector, secrets management, and staging endpoint tests; Week 3 covers end-to-end integration tests, GitHub Actions gating, and observability hardening; Week 4 covers load and failure drills, rollback rehearsal, and production readiness sign-off.

### Risks & Mitigations
- Risk: Model host downtime or GPU exhaustion causes user-facing failures. Mitigation: Add health checks, autoscaling or warm standby option, strict timeout and retry limits, and graceful fallback messages.
- Risk: High latency from Lambda to model host impacts UX. Mitigation: Place services in same AWS region and VPC path, optimize model size and quantization, and monitor latency SLOs in CloudWatch.
- Risk: Hallucinated or unsafe model output reaches users. Mitigation: Enforce multi-agent verification, deterministic output validators, and block responses that fail policy checks.
- Risk: Secret leakage or insecure endpoint exposure. Mitigation: Keep endpoint private, use IAM roles and Secrets Manager, rotate keys, and enforce least-privilege network rules.