using Npgsql;

namespace Api;

public static class Database
{
    public static string BuildConnectionString(IConfiguration config)
    {
        var connectionName = config["POSTGRES_CONNECTION_NAME"]
            ?? throw new InvalidOperationException("POSTGRES_CONNECTION_NAME is not set");
        var database = config["POSTGRES_DB"] ?? "postgres";
        var user = config["POSTGRES_USER"] ?? "postgres";
        // Secret Manager values (and how Cloud Run mounts them as env vars) can carry
        // a trailing newline depending on how the secret was created - trim it so it
        // doesn't silently break password auth.
        var password = config["POSTGRES_PASSWORD"]?.Trim()
            ?? throw new InvalidOperationException("POSTGRES_PASSWORD is not set");

        // Cloud Run mounts the Cloud SQL Auth Proxy as a unix socket under /cloudsql
        // when the instance is attached via --add-cloudsql-instances.
        var socketDir = $"/cloudsql/{connectionName}";

        return new NpgsqlConnectionStringBuilder
        {
            Host = socketDir,
            Database = database,
            Username = user,
            Password = password,
        }.ConnectionString;
    }

    // The "users" table already exists with a single "users" text column.
    public static async Task<List<string>> GetUsersAsync(string connectionString, ILogger logger)
    {
        const string sql = "SELECT users FROM users";
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;

            var results = new List<string>();
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                results.Add(reader.GetString(0));
            }

            logger.LogInformation(
                "Query {Sql} returned {RowCount} rows in {ElapsedMs}ms",
                sql, results.Count, stopwatch.ElapsedMilliseconds);
            return results;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Query {Sql} failed after {ElapsedMs}ms", sql, stopwatch.ElapsedMilliseconds);
            throw;
        }
    }
}
