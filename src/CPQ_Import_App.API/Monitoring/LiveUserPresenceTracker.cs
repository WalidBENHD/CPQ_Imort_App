using System.Collections.Concurrent;

namespace CPQ_Import_App.API.Monitoring;

public interface ILiveUserPresenceTracker
{
    void MarkSeen(string userId);
    DateTime? GetLastSeenUtc(string userId);
}

public class LiveUserPresenceTracker : ILiveUserPresenceTracker
{
    private readonly ConcurrentDictionary<string, DateTime> lastSeenByUserId = new(StringComparer.Ordinal);

    public void MarkSeen(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return;
        }

        lastSeenByUserId.AddOrUpdate(userId, DateTime.UtcNow, static (_, _) => DateTime.UtcNow);
    }

    public DateTime? GetLastSeenUtc(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return null;
        }

        return lastSeenByUserId.TryGetValue(userId, out var lastSeenAtUtc)
            ? lastSeenAtUtc
            : null;
    }
}