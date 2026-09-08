# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: Build the Angular frontend
# ---------------------------------------------------------------------------
FROM node:22-slim AS web-build
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build -- --configuration production

# ---------------------------------------------------------------------------
# Stage 2: Build and publish the .NET backend
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src
COPY src/Api/*.csproj ./Api/
RUN dotnet restore ./Api/*.csproj
COPY src/Api/ ./Api/
RUN dotnet publish ./Api/*.csproj -c Release -o /app/publish --no-restore

# ---------------------------------------------------------------------------
# Stage 3: Runtime image - just the published API + the built Angular assets
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# .NET 8+ convention for container port binding - Cloud Run expects the
# container to listen on 8080 by default (it sets $PORT to 8080 unless
# configured otherwise, and this must match).
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

COPY --from=api-build /app/publish .

# IMPORTANT - VERIFY THIS PATH before your first build.
# Angular 17+'s default `ng build` output lands at:
#   dist/<project-name>/browser/
# <project-name> is whatever you name it when you run `ng new <name>`.
# If you run `ng new web` inside the web/ folder, this should be correct
# as-is. If you use a different project name, or an older Angular version
# (pre-application builder, output lands directly under dist/<name>/
# with no /browser suffix), update the path below to match.
COPY --from=web-build /web/dist/web/browser ./wwwroot

ENTRYPOINT ["dotnet", "Api.dll"]
