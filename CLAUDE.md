# ngcc02 — onboarding app

Angular SPA + .NET minimal API, single Cloud Run service, Entra ID (Azure AD) login, Postgres-backed users list.

## Architecture

- `web/` — Angular 22 app (zoneless: no `zone.js`, no polyfills entry in `angular.json`). Auth state lives in `AuthService` as **signals**, not RxJS `BehaviorSubject` + manual `.subscribe()` — plain-field mutation from a subscribe callback does not trigger re-render in a zoneless app.
- `src/Api/` — .NET 10 minimal API (`Program.cs`). Serves the built Angular app from `wwwroot` (populated by the Docker build) and exposes `/api/*` routes.
- Single container: [Dockerfile](Dockerfile) builds both and ships one image — one Cloud Run service (`onboarding-app`, region `us-central1`, project `ngcc02-poc`), not two.
- Auth: Entra ID app registration, client ID `83e6cc0c-00d8-4255-b61c-ff4bad49a6ac`, tenant `6d0b30ef-e3c7-4b3b-aad9-f4b5a6bef04e`. SPA uses `angular-oauth2-oidc` (PKCE code flow). API validates the same tokens via `Microsoft.Identity.Web`. `/api/auth/user` and `/api/users` both `RequireAuthorization()` — the SPA requests the `api://83e6cc0c.../access_as_user` scope alongside `openid profile email` so it gets a token audienced for this API.
- DB: Cloud SQL Postgres instance `ngcc02-db`, database `ngccdb`. Connected from Cloud Run via the built-in Cloud SQL Auth Proxy over a unix socket (`--add-cloudsql-instances`), not a public-IP connection. The `users` table has just `id` (int) and `email` (text) — don't assume a richer schema without checking.
- Logging: `FileLoggerProvider` ([src/Api/FileLogger.cs](src/Api/FileLogger.cs)) writes every `ILogger` message to `/mnt/data/logs/server.log` on a GCS-FUSE-mounted volume (`app-storage` / bucket `ngcc02-poc-app-storage-mvk99`), alongside a separate client-log-forwarding endpoint (`/api/logs` → `/mnt/data/logs/app.log`).

## Deploying

**Deploys go through GitHub Actions, not manual `gcloud run deploy`.** Push to `main` and [.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds the Docker image, pushes it to Artifact Registry (`app-images`), and deploys — authenticated via Workload Identity Federation (service account `github-actions-deployer@ngcc02-poc.iam.gserviceaccount.com`, no long-lived key). Watch a run with `gh run watch <run-id> --exit-status`.

Cloud Run service config (env vars, secrets, Cloud SQL attachment) persists across these deploys automatically — `gcloud run deploy`/the deploy-cloudrun action merges with the previous revision's spec rather than resetting it, *except* `gcloud run services update --set-env-vars` (as opposed to `--update-env-vars`) **replaces the entire env var list** rather than merging. Use `--update-env-vars` unless you intend to wipe everything else.

## Known gotchas (already fixed, but worth knowing)

- **`appsettings.json` `${VAR}`-style placeholders are not interpolated by .NET config** — that syntax does nothing. The `AzureAd:*` section is populated at runtime in `Program.cs` by explicitly mapping the `AZURE_AD_TENANT_ID` / `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` Cloud Run env vars onto the `AzureAd:` config keys via `AddInMemoryCollection`.
- **Secret Manager values can carry trailing whitespace** (a stray `\r\r\n` bit us once) depending on how the secret was created. `Database.BuildConnectionString` trims `POSTGRES_PASSWORD` defensively. If you ever reset the Cloud SQL password to match a secret manually via `gcloud sql users set-password --password="$(gcloud secrets versions access ...)"`, remember bash `$(...)` only strips a trailing `\n`, not `\r` — pipe through `tr -d '\r\n'` first or the two will silently mismatch.
- **The SPA needs the `api://.../access_as_user` scope** to call any `RequireAuthorization()` endpoint on this API — `openid profile email` alone only gets an id_token/Graph-audience token, not one this API will accept. If you ever see 401s with `IDX10511: Signature validation failed` despite a matching `kid`, that's usually this — or check whether the app registration's own **API permissions** (not just "Expose an API") includes `access_as_user` with admin consent granted, since this is a self-referencing SPA+API app.
- User info (name/email/groups) is read client-side from the **id_token claims** (`AuthService.extractUserInfo`), not fetched from the API — avoids needing the API scope just to show who's logged in. `groups` requires the "groups" optional claim to be enabled on the app registration's ID token (Token configuration blade); large group counts can hit Azure AD's overage limit and omit the claim entirely.
