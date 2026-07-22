using System.Text.Json;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Infrastructure.Services;

public sealed class ActiveDatasetReader(IImportRepository repository) : IActiveDatasetReader
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<IReadOnlyList<ActiveDatasetRecord>> GetRecordsAsync(
        EntityType entityType,
        CancellationToken ct = default)
    {
        var activePublication = await repository.GetLatestCommittedJobAsync(entityType, ct);
        if (activePublication is null)
        {
            return [];
        }

        var rows = await repository.GetStagingRowsByJobAsync(activePublication.Id, ct);
        return rows
            .OrderBy(row => row.RowNumber)
            .Select((row, index) => ToRecord(entityType, row, index))
            .ToList();
    }

    private static ActiveDatasetRecord ToRecord(EntityType entityType, StagingRow row, int index)
    {
        var fields = JsonSerializer.Deserialize<Dictionary<string, string?>>(row.RawData, JsonOptions)
            ?? new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        return new ActiveDatasetRecord(entityType, BuildKey(entityType, fields, index), fields);
    }

    private static string BuildKey(EntityType entityType, IReadOnlyDictionary<string, string?> fields, int index)
        => entityType switch
        {
            EntityType.Article => fields.GetValueOrDefault("ArticleNumber") ?? $"article-{index}",
            EntityType.PriceList => JoinKey(fields, "ArticleNumber", "Currency", "ValidFrom"),
            EntityType.Description => JoinKey(fields, "ArticleNumber", "LanguageCode"),
            EntityType.CurrencyRate => JoinKey(fields, "FromCurrency", "ToCurrency", "ValidFrom"),
            _ => $"record-{index}"
        };

    private static string JoinKey(IReadOnlyDictionary<string, string?> fields, params string[] names)
        => string.Join('|', names.Select(name => fields.GetValueOrDefault(name) ?? string.Empty));
}
