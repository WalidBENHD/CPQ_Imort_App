using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Models;

public sealed record ActiveDatasetRecord(
    EntityType EntityType,
    string Key,
    Dictionary<string, string?> Fields);
