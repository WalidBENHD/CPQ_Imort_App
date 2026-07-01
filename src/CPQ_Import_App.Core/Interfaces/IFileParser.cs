using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Core.Interfaces;

public interface IFileParser
{
    EntityType SupportedEntityType { get; }
    bool CanParse(string fileName, EntityType entityType);
    Task<IReadOnlyList<ParsedRow>> ParseAsync(Stream fileStream, string fileName, CancellationToken ct = default);
    List<ValidationMessage> ValidateRow(Dictionary<string, string?> fields);
}

public record ParsedRow(int RowNumber, Dictionary<string, string?> Fields, List<ValidationMessage> Messages, RowStatus Status);
