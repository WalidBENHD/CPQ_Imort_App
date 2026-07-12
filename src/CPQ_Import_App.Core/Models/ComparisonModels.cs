using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Models;

public sealed record ComparisonFieldChange(
    string Field,
    string? CurrentValue,
    string? BaselineValue,
    bool IsDifferent);

public sealed record ComparisonRowResult(
    Guid RowId,
    int RowNumber,
    string Key,
    string ComparisonStatus,
    int ChangedFieldCount,
    IReadOnlyList<ComparisonFieldChange> Changes);

public sealed record ComparisonMissingItem(
    string Key,
    IReadOnlyDictionary<string, string?> BaselineValues);

public sealed record ImportComparisonResult(
    Guid JobId,
    Guid BaselineJobId,
    EntityType EntityType,
    string EntityTypeLabel,
    bool HasBaseline,
    int ComparedRows,
    int NewRows,
    int ModifiedRows,
    int UnchangedRows,
    int MissingBaselineRows,
    IReadOnlyList<ComparisonRowResult> Rows,
    IReadOnlyList<ComparisonMissingItem> MissingRows);
