#!/usr/bin/env bash
set -euo pipefail

# One-time GCP setup for CI/CD via Workload Identity Federation.
# Run this once, locally, authenticated as a user/role with enough
# privilege to create service accounts, IAM bindings, and Artifact
# Registry repos (e.g., Owner or a custom role with the equivalent
# permissions) in the target project.
#
# Fill in every REPLACE_ME value before running.

PROJECT_ID="REPLACE_ME_your-gcp-project-id"
REGION="us-central1"
REPO_NAME="app-images"
SA_NAME="github-actions-deployer"
GITHUB_ORG="REPLACE_ME_your-github-org-or-username"
GITHUB_REPO="REPLACE_ME_your-repo-name"
POOL_ID="github-pool"
PROVIDER_ID="github-provider"

echo "== Confirming project =="
gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
echo "Project number: $PROJECT_NUMBER"

echo "== Enabling required APIs =="
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    iamcredentials.googleapis.com \
    cloudscheduler.googleapis.com \
    secretmanager.googleapis.com \
    sqladmin.googleapis.com

echo "== Creating Artifact Registry repository =="
gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Container images for the onboarding app" \
    || echo "(already exists - continuing)"

echo "== Creating the CI/CD deployer service account =="
gcloud iam service-accounts create "$SA_NAME" \
    --display-name="GitHub Actions Deployer" \
    || echo "(already exists - continuing)"

DEPLOYER_SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "== Granting minimum required roles to the deployer service account =="
# roles/run.admin: deploy new revisions to Cloud Run
# roles/artifactregistry.writer: push built images
# roles/iam.serviceAccountUser: required to deploy Cloud Run services that
#   themselves run as a (different, more restricted) runtime service account
for ROLE in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${DEPLOYER_SA_EMAIL}" \
        --role="$ROLE" \
        --condition=None
done

echo "== Creating the Workload Identity Pool =="
gcloud iam workload-identity-pools create "$POOL_ID" \
    --location="global" \
    --display-name="GitHub Actions Pool" \
    || echo "(already exists - continuing)"

echo "== Creating the GitHub OIDC provider within the pool =="
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --location="global" \
    --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub Provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    || echo "(already exists - continuing)"

echo "== Restricting impersonation to this specific repository only =="
# This binding is deliberately scoped to attribute.repository, not the
# whole pool - only workflow runs FROM this exact GitHub repo can
# impersonate the deployer service account. Do not widen this to the
# pool level without a real reason to.
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA_EMAIL" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"

echo ""
echo "== Done. Fill these values into .github/workflows/deploy.yml: =="
echo "GCP_PROJECT_ID:              $PROJECT_ID"
echo "WORKLOAD_IDENTITY_PROVIDER:  projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
echo "DEPLOYER_SA:                 $DEPLOYER_SA_EMAIL"
