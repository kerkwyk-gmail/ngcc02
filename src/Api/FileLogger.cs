using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Api;

/// <summary>
/// Minimal file logger provider - writes every logged message to a single file
/// under the mounted /mnt/data volume so logs survive container restarts.
/// </summary>
public sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly string _logFilePath;
    private readonly object _writeLock = new();
    private readonly ConcurrentDictionary<string, FileLogger> _loggers = new();

    public FileLoggerProvider(string logDirectory)
    {
        Directory.CreateDirectory(logDirectory);
        _logFilePath = Path.Combine(logDirectory, "server.log");
    }

    public ILogger CreateLogger(string categoryName) =>
        _loggers.GetOrAdd(categoryName, name => new FileLogger(name, _logFilePath, _writeLock));

    public void Dispose() => _loggers.Clear();

    private sealed class FileLogger(string categoryName, string logFilePath, object writeLock) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;

            var timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss.fff");
            var message = formatter(state, exception);
            var line = $"[{timestamp}] [{logLevel}] [{categoryName}] {message}";
            if (exception is not null)
            {
                line += Environment.NewLine + exception;
            }

            lock (writeLock)
            {
                try
                {
                    File.AppendAllText(logFilePath, line + Environment.NewLine);
                }
                catch
                {
                    // Logging must never crash the request pipeline.
                }
            }
        }
    }
}
