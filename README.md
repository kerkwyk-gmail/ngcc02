# Stack bootstrap — build a container, ship it via CI/CD to Cloud Run

Goal of this step, specifically: prove the whole pipeline works end to end
(repo → GitHub Actions → Artifact Registry → Cloud Run) with the simplest
possible app. Auth, database, scheduling, and the ServiceNow webhook all
come later, once this mechanism is proven.

**Not verified in this environment**: no `dotnet` SDK and no network access
were available where these files were generated, so nothing here has been
compiled or run. Everything is hand-written from current, confident
knowledge of .NET 10 / Angular / Cloud Run conventions — treat your first
real CI run as the actual verification, not something already confirmed.

## Order of operations

### 1. Generate the Angular app yourself

Don't reuse a hand-written scaffold for this part — run the real generator
so the output matches your actual Angular CLI version exactly:

```bash
npx @angular/cli@latest new web --routing --style=scss
```

Run this in the repo root, so you end up with a `web/` folder alongside
`src/Api/`. If you name the project something other than `web`, update the
Dockerfile's final `COPY --from=web-build` line to match.

### 2. Confirm your Angular build output path

```bash
cd web && npm run build -- --configuration production
ls dist/
```

The Dockerfile assumes `dist/web/browser/` (Angular 17+'s default with the
application builder). If your output looks different, update the
Dockerfile's `COPY --from=web-build /web/dist/web/browser ./wwwroot` line
to match what you actually see.

### 3. One-time GCP setup

Edit the `REPLACE_ME_*` values in `gcp-setup/setup.sh`, then run it once,
authenticated as a user with sufficient project privilege:

```bash
gcloud auth login
bash gcp-setup/setup.sh
```

This creates: the Artifact Registry repo, the CI/CD deployer service
account with minimum required roles, a Workload Identity Pool + GitHub
OIDC provider, and a binding restricting impersonation to your specific
repository only — no long-lived JSON service account key is ever created
or stored anywhere.

The script prints three values at the end — copy them into
`.github/workflows/deploy.yml`, replacing the matching `REPLACE_WITH_*`
placeholders.

### 4. Push and watch it build

```bash
git add .
git commit -m "Initial container build pipeline"
git push origin main
```

Watch the run under your repo's **Actions** tab. If it succeeds, Cloud Run
will show a new revision — the service URL's `/healthz` endpoint should
return `{"status":"ok"}`.

### 5. Allow public (or authenticated) traffic

The `deploy-cloudrun` action does not automatically make the service
publicly reachable. For this bootstrap step, to just confirm it responds:

```bash
gcloud run services add-iam-policy-binding onboarding-app \
    --region=us-central1 \
    --member="allUsers" \
    --role="roles/run.invoker"
```

This is deliberately temporary and wide open — once Entra ID auth is
wired in (a later step), this binding should be tightened or removed
entirely, since the app itself will handle who's allowed in.

## What's deliberately not in this step

- No authentication (Entra ID comes later)
- No database connection (Cloud SQL comes later)
- No Secret Manager usage yet
- No Cloud Scheduler jobs yet
- No ServiceNow webhook endpoint yet

Each of those is a self-contained addition on top of this working
pipeline, not a redesign of it.
