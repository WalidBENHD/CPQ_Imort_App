using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Models;

public class StagingRow
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ImportJobId { get; set; }
    public int RowNumber { get; set; }
    public RowStatus Status { get; set; } = RowStatus.Valid;

    /// <summary>JSON-serialized dictionary of column → value for this row.</summary>
    public string RawData { get; set; } = string.Empty;

    /// <summary>JSON-serialized list of ValidationMessage.</summary>
    public string? ValidationMessages { get; set; }

    public bool IsSelected { get; set; } = true;
    public bool IsUserAdded { get; set; }
    public bool IsUserModified { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletedByUserId { get; set; }
    public string? DeletedByDisplayName { get; set; }
    public ImportJob ImportJob { get; set; } = null!;
}
