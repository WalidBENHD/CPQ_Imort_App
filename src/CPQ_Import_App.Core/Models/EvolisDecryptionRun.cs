using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Models;

public class EvolisDecryptionRun
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string FileHash { get; set; } = string.Empty;
    public string? SourceContentType { get; set; }
    public byte[]? SourceFileContent { get; set; }
    public string? DecryptedContent { get; set; }
    public bool HasSourceFile { get; set; }
    public bool HasResult { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserDisplayName { get; set; } = string.Empty;
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
    public EvolisDecryptionStatus Status { get; set; } = EvolisDecryptionStatus.Processing;
    public string? OutputFormat { get; set; }
    public string? FailureReason { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedByUserId { get; set; }
    public string? DeletedByDisplayName { get; set; }
}
