# NOVA

NOVA is a focus workspace with projects, tasks, Pomodoro sessions, ambient audio, real analytics, achievements, offline caching, and account synchronization.

The product uses a Vinext/React application and an optional Docker Compose intelligence stack:

- **Go API gateway** — authentication, request limits, timeouts, health aggregation, and routing.
- **Python analytics** — real-session summaries, focus score, best working hour, project distribution, and recommendations.
- **C++ timer engine** — validated Pomodoro cycles and deterministic phase plans.

The browser always talks to same-origin `/api/engine/*` routes. Internal credentials never reach client code. If the container stack is unavailable, the site switches to an embedded compatible engine so an active timer is never interrupted.

## Requirements

- Node.js 22.13 or newer
- Docker Desktop with Docker Compose
- Go 1.24+ only when running gateway tests outside Docker

## Web application

```bash
npm install
npm run dev
npm test
```

## Polyglot services

Create a local environment file from `.env.example`, replace the development secret, and start the stack:

```bash
docker compose up --build
```

The gateway listens on `http://localhost:8080` by default. If that port is occupied, set `NOVA_GATEWAY_PORT=18080` in `.env`. Python and C++ remain isolated on the private Compose network.

Useful commands:

```bash
npm run services:build
npm run services:up
npm run services:down
```

Each service runs its own tests during image construction. Compose also waits for all health checks before declaring the stack ready.

## Connect the site to Docker

Set these server-side values for the NOVA web runtime:

```dotenv
NOVA_SERVICES_URL=http://127.0.0.1:8080
NOVA_SERVICES_TOKEN=the-same-value-as-NOVA_INTERNAL_TOKEN
```

Do not prefix these keys with `NEXT_PUBLIC_`. For a hosted website, deploy the Compose stack behind HTTPS and set `NOVA_SERVICES_URL` to that private gateway address.

Detailed request flow, production notes, endpoints, and security controls are documented in [docs/polyglot-architecture.md](docs/polyglot-architecture.md).

## Data and authentication

- Supabase provides public email/password and Google account authentication.
- Server APIs keep authorization decisions outside browser state.
- Cloudflare D1 stores synchronized projects, tasks, sessions, and preferences.
- Browser storage is used only as an offline cache and queued-change buffer.

## Production checks

```bash
npm test
docker compose build
docker compose up -d --wait
```

After the checks, call the gateway health endpoint and then stop the local stack with `docker compose down`.
