using Microsoft.Identity.Web;

var builder = WebApplication.CreateBuilder(args);

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

// Use authentication middleware
app.UseAuthentication();
app.UseAuthorization();
app.UseCors();

// Serves the built Angular app from wwwroot (populated by the Docker build - see Dockerfile).
app.UseDefaultFiles();
app.UseStaticFiles();

// Health check
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

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
