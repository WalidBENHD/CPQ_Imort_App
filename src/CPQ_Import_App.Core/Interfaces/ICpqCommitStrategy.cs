using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Interfaces;

public interface ICpqCommitStrategy
{
    EntityType EntityType { get; }
    Task CommitRowsAsync(
        IEnumerable<Dictionary<string, string?>> rows,
        IReadOnlyCollection<string> removedKeys,
        CancellationToken ct = default);
}
