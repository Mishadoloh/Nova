# NOVA polyglot services

NOVA keeps the browser application responsive while delegating specialized work to three isolated services.

## Request path

1. The browser calls `/api/engine/*` on the existing NOVA origin.
2. The site route validates and limits the payload. It never exposes the internal token.
3. The route calls the Go gateway when `NOVA_SERVICES_URL` and `NOVA_SERVICES_TOKEN` are configured.
4. Go authenticates the request, adds a request ID, applies timeouts, and forwards it to the appropriate private service.
5. Python computes focus analytics. C++ validates Pomodoro settings and builds the timer schedule.
6. If the external stack is unavailable, the site returns a compatible embedded result so the focus timer never becomes unusable.

## Local development

Copy `.env.example` to `.env`, replace the development token, then run:

```bash
docker compose up --build
```

The gateway is available at `http://localhost:8080`. Python and C++ are only reachable on the private Compose network.

## Production

Host the Compose stack on a private container platform, configure HTTPS, and set the site runtime variables:

- `NOVA_SERVICES_URL=https://your-private-gateway.example`
- `NOVA_SERVICES_TOKEN=<same secret as NOVA_INTERNAL_TOKEN>`

Rotate the token regularly. Do not use a `NEXT_PUBLIC_` prefix and do not expose the Python or C++ services publicly.

## Endpoints

| Endpoint                     | Owner             | Purpose                              |
| ---------------------------- | ----------------- | ------------------------------------ |
| `GET /health`                | Go                | Aggregated service health            |
| `GET /ready`                 | Go                | Gateway readiness                    |
| `POST /v1/analytics/summary` | Python through Go | Aggregates real focus sessions       |
| `POST /v1/timer/plan`        | C++ through Go    | Builds a validated Pomodoro schedule |

## Security and reliability

- Shared service authentication is checked at both Go and downstream services.
- The browser only sees same-origin routes and never receives the shared secret.
- Request bodies are size-limited and JSON is validated before proxying.
- Containers run as non-root users and expose only the gateway port.
- Health checks, graceful shutdown, upstream timeouts, and restart policies are included.
- The site adapter has a bounded fallback for availability; its response declares `mode: embedded` so monitoring can detect it.
