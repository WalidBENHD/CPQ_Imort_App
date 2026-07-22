using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Core.Interfaces;

public interface IActiveDatasetReader
{
    Task<IReadOnlyList<ActiveDatasetRecord>> GetRecordsAsync(
        EntityType entityType,
        CancellationToken ct = default);
}
