using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Core.Interfaces;

public interface IBusinessTraceService
{
    Task<IReadOnlyList<BusinessTraceSuggestion>> GetSuggestionsAsync(
        string scopeKey,
        EntityType objectType,
        int limit = 6,
        CancellationToken ct = default);

    Task<BusinessTraceResult?> SearchAsync(
        string scopeKey,
        EntityType objectType,
        string identifier,
        CancellationToken ct = default);
}
