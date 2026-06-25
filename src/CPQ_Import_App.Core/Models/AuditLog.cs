namespace CPQ_Import_App.Core.Models;

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ImportJobId { get; set; }
    public string Action { get; set; } = string.Empty;   // Uploaded, Committed, Rejected
    public string PerformedBy { get; set; } = string.Empty;
    public string PerformedByDisplayName { get; set; } = string.Empty;
    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;
    public string? Details { get; set; }
    public ImportJob ImportJob { get; set; } = null!;
}
