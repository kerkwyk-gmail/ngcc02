var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

// Serves the built Angular app from wwwroot (populated by the Docker build - see Dockerfile).
app.UseDefaultFiles();
app.UseStaticFiles();

// Simple, unauthenticated health check - this is what confirms Cloud Run
// can actually start and serve traffic. Auth, DB, and everything else
// discussed comes later; this step is deliberately just "does the
// container build, deploy, and respond."
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

// Angular client-side routing: any request that isn't a real static file
// or API route falls back to index.html, letting Angular's router handle it.
app.MapFallbackToFile("index.html");

app.Run();
