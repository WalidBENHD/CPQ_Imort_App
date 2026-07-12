using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Metadata;

public sealed record DatasetDefinition(
    EntityType EntityType,
    string DisplayName,
    string Owner,
    string TemplateName,
    string Status,
    string CurrentVersion,
    string Description,
    string FileNameFragment,
    IReadOnlyList<DatasetColumnRequirement> Columns,
    IReadOnlyList<DatasetValidationRule> ValidationRules);

public sealed record DatasetColumnRequirement(
    string Name,
    bool Required,
    string DataType,
    string Description,
    string? Example = null);

public sealed record DatasetValidationRule(
    string Field,
    string Rule,
    string Severity = "Error");

public static class DatasetCatalog
{
    private static readonly IReadOnlyDictionary<EntityType, DatasetDefinition> Definitions = new Dictionary<EntityType, DatasetDefinition>
    {
        [EntityType.Article] = new(
            EntityType.Article,
            "Article Master",
            "Saint-Marcellin PDU Data Owner",
            "Article Master Template",
            "Active",
            "v1.0",
            "Governed article master data for the Saint-Marcellin PDU pilot.",
            "Product_Master",
            [
                new DatasetColumnRequirement("ArticleNumber", true, "Text", "Unique product identifier.", "PDU-100245"),
                new DatasetColumnRequirement("Name", true, "Text", "Commercial article name.", "Industrial PDU"),
                new DatasetColumnRequirement("Category", true, "Text", "Business category or family.", "Standard"),
                new DatasetColumnRequirement("Unit", true, "Text", "Sales or stocking unit.", "PC")
            ],
            [
                new DatasetValidationRule("ArticleNumber", "Required, max length 50 characters, and must not contain spaces."),
                new DatasetValidationRule("Name", "Required and max length 255 characters."),
                new DatasetValidationRule("Category", "Required; must be a valid business category."),
                new DatasetValidationRule("Unit", "Required; must be a controlled unit code.")
            ]),
        [EntityType.PriceList] = new(
            EntityType.PriceList,
            "Basis Price",
            "Saint-Marcellin PDU Pricing Owner",
            "Basis Price Template",
            "Active",
            "v1.0",
            "Single unit price used by CPQ for the Saint-Marcellin PDU pilot.",
            "Basis_Price",
            [
                new DatasetColumnRequirement("ArticleNumber", true, "Text", "Product identifier that must already exist in Article Master.", "PDU-100245"),
                new DatasetColumnRequirement("UnitPrice", true, "Decimal", "Price per unit used by CPQ.", "125.50"),
                new DatasetColumnRequirement("Currency", true, "Text", "ISO 4217 currency code.", "EUR"),
                new DatasetColumnRequirement("ValidFrom", true, "Date", "Price validity start date.", "2026-01-01"),
                new DatasetColumnRequirement("ValidTo", false, "Date", "Price validity end date.", "2026-12-31")
            ],
            [
                new DatasetValidationRule("ArticleNumber", "Required, must not contain spaces, and must already exist in Article Master."),
                new DatasetValidationRule("UnitPrice", "Required and must be a valid decimal number."),
                new DatasetValidationRule("Currency", "Required; must be a 3-letter ISO 4217 code (e.g., EUR)."),
                new DatasetValidationRule("ValidFrom", "Required and must be a valid date."),
                new DatasetValidationRule("ValidTo", "Optional; when provided, must be a valid date.", "Warning")
            ]),
    };

    public static IReadOnlyList<DatasetDefinition> All =>
        Definitions.Values.OrderBy(d => d.DisplayName).ToList();

    public static DatasetDefinition Get(EntityType entityType)
        => Definitions.TryGetValue(entityType, out var definition)
            ? definition
            : new DatasetDefinition(
                entityType,
                entityType.ToString(),
                "Unassigned",
                $"{entityType} Template",
                "Unknown",
                "v1.0",
                "No dataset metadata is configured for this entity type.",
                entityType.ToString(),
                [],
                []);

    public static bool IsSupported(EntityType entityType)
        => Definitions.ContainsKey(entityType);

    public static IReadOnlyList<string> GetDisplayNames()
        => All.Select(d => d.DisplayName).ToList();

    public static string GetValidDatasetList()
        => string.Join(", ", GetDisplayNames());
}
