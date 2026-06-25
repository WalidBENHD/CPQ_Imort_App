namespace CPQ_Import_App.Core.Models;

public class ValidationMessage
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public ValidationSeverity Severity { get; set; }
}

public enum ValidationSeverity { Info, Warning, Error }
