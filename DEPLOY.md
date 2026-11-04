# Deploy DailyCollabs

DailyCollabs runs as a React static frontend, an Express API, a FastAPI feed-discovery service, and MongoDB. Hosting plans and model availability vary; choose services that meet the application's runtime and database requirements.

## Local development

Use the complete [README setup](README.md#run-locally) and `node scripts/dev.cjs`. Node 20.19+ or 22.12+, Python 3.10+, and MongoDB 7 are required. MongoDB may run in Docker while the three application services run on the host.

## Separate services

| Service | Working directory | Install/build | Start/publish |
| --- | --- | --- | --- |
| API | `Backend` | `npm ci` | `npm start` |
| AI | `ai_service` | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Frontend | `Frontend/client` | `npm ci && npm run build` | Serve `dist` with SPA fallback to `index.html` |

Configure the API with `MONGO_URI`, a unique `JWT_SECRET`, the deployed `AI_SERVICE_URL`, and the public `FRONTEND_URL` used in comment/repost links. Set `PORT` to the host's supplied port. The optional `YOUTUBE_API_KEY` enables official video search; public search remains best-effort.

Build the frontend with `VITE_API_URL` set to the public API URL. This setting is compiled into the frontend, so rebuild when it changes. Configure HTTPS and appropriate origin restrictions for your deployment.

The Python service accepts the provider settings in `ai_service/.env.example`. Use secrets supplied by the host, not checked-in `.env` files. With no configured provider key, its locale-aware deterministic feed fallback remains available.

The included `render.yaml` is a starting blueprint for the three services. Set the database URI and deployed service URLs yourself. Use database access restrictions appropriate to your host rather than opening it to every address. Do not assume that any hosting or model tier is free or permanently available.

## Operational checks

- API `/health` includes MongoDB connection readiness.
- AI `/health` reports process readiness.
- Public `/agent-status` exposes project mission/check status, not account credentials.
- Run `npm --prefix Backend test` and `npm --prefix Frontend/client run build` before release.
- Run `scripts/quality-watch.cjs` separately if you want continuous local checks. It monitors and reports; active coding sessions perform code repairs.
