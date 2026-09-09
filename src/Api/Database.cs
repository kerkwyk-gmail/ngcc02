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
        var password = config["POSTGRES_PASSWORD"]
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

    public static async Task EnsureUsersTableAsync(string connectionString, ILogger logger)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();

        await using (var createCmd = conn.CreateCommand())
        {
            createCmd.CommandText = """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """;
            await createCmd.ExecuteNonQueryAsync();
        }

        await using (var countCmd = conn.CreateCommand())
        {
            countCmd.CommandText = "SELECT COUNT(*) FROM users";
            var count = (long)(await countCmd.ExecuteScalarAsync() ?? 0L);
            if (count == 0)
            {
                logger.LogInformation("users table is empty, seeding sample rows");
                await using var seedCmd = conn.CreateCommand();
                seedCmd.CommandText = """
                    INSERT INTO users (name, email) VALUES
                        ('Alice Example', 'alice@example.com'),
                        ('Bob Example', 'bob@example.com'),
                        ('Carol Example', 'carol@example.com');
                    """;
                await seedCmd.ExecuteNonQueryAsync();
            }
        }
    }

    public static async Task<List<UserRow>> GetUsersAsync(string connectionString)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, name, email, created_at FROM users ORDER BY id";

        var results = new List<UserRow>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            results.Add(new UserRow(
                reader.GetInt32(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetFieldValue<DateTimeOffset>(3)));
        }

        return results;
    }
}

public record UserRow(int Id, string Name, string Email, DateTimeOffset CreatedAt);
