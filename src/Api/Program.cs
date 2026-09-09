using Api;
using Microsoft.Identity.Web;

var builder = WebApplication.CreateBuilder(args);

// Persist application logs to the mounted volume alongside client-forwarded logs.
builder.Logging.AddProvider(new FileLoggerProvider(Path.Combine("/mnt/data", "logs")));

// Add Entra ID OIDC authentication
builder.Services.AddMicrosoftIdentityWebApiAuthentication(builder.Configuration);

// Add CORS to allow Angular app to call the API
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

var app = builder.Build();

var requestLogger = app.Logger;

// Log every request/response so auth failures show up in the persisted log file.
app.Use(async (context, next) =>
{
    await next();
    requestLogger.LogInformation(
        "{Method} {Path} -> {StatusCode} (authenticated: {IsAuthenticated})",
        context.Request.Method,
        context.Request.Path,
        context.Response.StatusCode,
        context.User.Identity?.IsAuthenticated ?? false);
});

// Use authentication middleware
app.UseAuthentication();
app.UseAuthorization();
app.UseCors();

// Serves the built Angular app from wwwroot (populated by the Docker build - see Dockerfile).
app.UseDefaultFiles();
app.UseStaticFiles();

// Health check
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

// Client logging endpoint - accepts logs from Angular app and writes to persistent storage
app.MapPost("/api/logs", async (HttpRequest request) =>
{
    try
    {
        // Ensure logs directory exists
        var logsDir = Path.Combine("/mnt/data", "logs");
        Directory.CreateDirectory(logsDir);
        
        // Read body
        request.Body.Position = 0;
        using var reader = new StreamReader(request.Body);
        var content = await reader.ReadToEndAsync();
        
        // Append to log file with timestamp
        var logFile = Path.Combine(logsDir, "app.log");
        var timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss.fff");
        await System.IO.File.AppendAllTextAsync(logFile, $"[{timestamp}] {content}\n");
        
        return Results.Ok(new { status = "logged" });
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Error writing logs: {ex}");
        return Results.StatusCode(500);
    }
});

// User info endpoint - returns authenticated user's info and group memberships
app.MapGet("/api/auth/user", (HttpContext context) =>
{
    if (!context.User.Identity?.IsAuthenticated ?? false)
    {
        return Results.Unauthorized();
    }

    var userInfo = new
    {
        name = context.User.FindFirst("name")?.Value,
        email = context.User.FindFirst("preferred_username")?.Value ?? context.User.FindFirst("upn")?.Value,
        id = context.User.FindFirst("sub")?.Value,
        groups = context.User.FindAll("groups").Select(c => c.Value).ToList()
    };

    return Results.Ok(userInfo);
}).RequireAuthorization();

// Angular client-side routing: any request that isn't a real static file
// or API route falls back to index.html, letting Angular's router handle it.
app.MapFallbackToFile("index.html");

app.Run();
