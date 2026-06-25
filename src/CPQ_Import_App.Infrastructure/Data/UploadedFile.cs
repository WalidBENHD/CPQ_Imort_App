namespace CPQ_Import_App.Infrastructure.Data;

/// <summary>Stores the raw bytes of an uploaded file for later re-download.</summary>
public class UploadedFile
{
    public Guid JobId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public byte[] Content { get; set; } = [];
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
