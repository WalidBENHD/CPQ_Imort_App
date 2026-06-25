using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Infrastructure.Parsers;

/// <summary>Shared validation helpers reused across all entity parsers.</summary>
public static class RowValidator
{
    public static void RequireField(Dictionary<string, string?> fields, string key,
        List<ValidationMessage> msgs)
    {
        if (!fields.TryGetValue(key, out var val) || string.IsNullOrWhiteSpace(val))
            msgs.Add(new ValidationMessage
            {
                Field = key,
                Message = $"'{key}' is required.",
                Severity = ValidationSeverity.Error
            });
    }

    public static void RequireDecimal(Dictionary<string, string?> fields, string key,
        List<ValidationMessage> msgs)
    {
        if (fields.TryGetValue(key, out var val) && !string.IsNullOrWhiteSpace(val)
            && !decimal.TryParse(val, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out _))
        {
            msgs.Add(new ValidationMessage
            {
                Field = key,
                Message = $"'{key}' must be a valid number (got '{val}').",
                Severity = ValidationSeverity.Error
            });
        }
    }

    public static void RequireDate(Dictionary<string, string?> fields, string key,
        List<ValidationMessage> msgs)
    {
        if (fields.TryGetValue(key, out var val) && !string.IsNullOrWhiteSpace(val)
            && !DateTime.TryParse(val, out _))
        {
            msgs.Add(new ValidationMessage
            {
                Field = key,
                Message = $"'{key}' must be a valid date (got '{val}'). Use YYYY-MM-DD.",
                Severity = ValidationSeverity.Error
            });
        }
    }

    public static void MaxLength(Dictionary<string, string?> fields, string key,
        int max, List<ValidationMessage> msgs)
    {
        if (fields.TryGetValue(key, out var val) && val?.Length > max)
            msgs.Add(new ValidationMessage
            {
                Field = key,
                Message = $"'{key}' exceeds maximum length of {max} characters.",
                Severity = ValidationSeverity.Warning
            });
    }

    public static RowStatus DeriveStatus(IEnumerable<ValidationMessage> msgs)
    {
        if (msgs.Any(m => m.Severity == ValidationSeverity.Error)) return RowStatus.Error;
        if (msgs.Any(m => m.Severity == ValidationSeverity.Warning)) return RowStatus.Warning;
        return RowStatus.Valid;
    }
}
