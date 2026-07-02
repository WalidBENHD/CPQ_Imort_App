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
            "Product Master",
            "Product Data Stewardship",
            "Product Master Template",
            "Active",
            "v3.2",
            "Core product attributes used across CPQ updates and downstream sites.",
            "Product_Master",
            [
                new DatasetColumnRequirement("ArticleNumber", true, "Text", "Unique product identifier.", "A-100045"),
                new DatasetColumnRequirement("Name", true, "Text", "Product display name.", "Hydraulic Pump"),
                new DatasetColumnRequirement("Category", false, "Text", "Business category or family.", "Industrial"),
                new DatasetColumnRequirement("Unit", false, "Text", "Sales or stocking unit.", "EA")
            ],
            [
                new DatasetValidationRule("ArticleNumber", "Required and max length 50 characters."),
                new DatasetValidationRule("Name", "Required and max length 255 characters."),
                new DatasetValidationRule("Category", "Optional; max length 100 characters.", "Warning"),
                new DatasetValidationRule("Unit", "Optional; max length 20 characters.", "Warning")
            ]),
        [EntityType.PriceList] = new(
            EntityType.PriceList,
            "Pricing Conditions",
            "Pricing Operations",
            "Pricing Conditions Template",
            "Active",
            "v4.1",
            "Commercial prices and validity windows controlled by the pricing team.",
            "Pricing_Conditions",
            [
                new DatasetColumnRequirement("ArticleNumber", true, "Text", "Product identifier aligned with Product Master.", "A-100045"),
                new DatasetColumnRequirement("Price", true, "Decimal", "Unit price value.", "149.99"),
                new DatasetColumnRequirement("Currency", true, "Text", "ISO 4217 currency code.", "USD"),
                new DatasetColumnRequirement("ValidFrom", true, "Date", "Price validity start date.", "2026-07-01"),
                new DatasetColumnRequirement("ValidTo", false, "Date", "Price validity end date.", "2026-12-31")
            ],
            [
                new DatasetValidationRule("ArticleNumber", "Required."),
                new DatasetValidationRule("Price", "Required and must be a valid decimal number."),
                new DatasetValidationRule("Currency", "Required; must be a 3-letter ISO 4217 code (e.g., USD)."),
                new DatasetValidationRule("ValidFrom", "Required and must be a valid date."),
                new DatasetValidationRule("ValidTo", "Optional; when provided, must be a valid date.", "Warning")
            ]),
        [EntityType.Description] = new(
            EntityType.Description,
            "Product Texts",
            "Localization Team",
            "Product Texts Template",
            "Active",
            "v2.5",
            "Localized descriptions and content aligned across all international sites.",
            "Product_Texts",
            [
                new DatasetColumnRequirement("ArticleNumber", true, "Text", "Product identifier aligned with Product Master.", "A-100045"),
                new DatasetColumnRequirement("LanguageCode", true, "Text", "Locale or language code.", "en-US"),
                new DatasetColumnRequirement("ShortDescription", true, "Text", "Short product description.", "Hydraulic pump 2.2kW"),
                new DatasetColumnRequirement("LongDescription", false, "Text", "Long-form product description.", "Industrial hydraulic pump suitable for...")
            ],
            [
                new DatasetValidationRule("ArticleNumber", "Required."),
                new DatasetValidationRule("LanguageCode", "Required; max length 10 characters."),
                new DatasetValidationRule("ShortDescription", "Required; max length 255 characters."),
                new DatasetValidationRule("LongDescription", "Optional; max length 4000 characters.", "Warning")
            ]),
        [EntityType.CurrencyRate] = new(
            EntityType.CurrencyRate,
            "Exchange Rates",
            "Finance Operations",
            "Exchange Rates Template",
            "Monitored",
            "v1.8",
            "Currency conversion references used for international pricing updates.",
            "Exchange_Rates",
            [
                new DatasetColumnRequirement("FromCurrency", true, "Text", "Source ISO 4217 currency code.", "EUR"),
                new DatasetColumnRequirement("ToCurrency", true, "Text", "Target ISO 4217 currency code.", "USD"),
                new DatasetColumnRequirement("Rate", true, "Decimal", "Conversion factor from source to target.", "1.0845"),
                new DatasetColumnRequirement("ValidFrom", true, "Date", "Date from which the rate is effective.", "2026-07-01")
            ],
            [
                new DatasetValidationRule("FromCurrency", "Required; must be a 3-letter ISO 4217 code."),
                new DatasetValidationRule("ToCurrency", "Required; must be a 3-letter ISO 4217 code."),
                new DatasetValidationRule("Rate", "Required; must be a decimal number greater than zero."),
                new DatasetValidationRule("ValidFrom", "Required and must be a valid date.")
            ])
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

    public static IReadOnlyList<string> GetDisplayNames()
        => All.Select(d => d.DisplayName).ToList();

    public static string GetValidDatasetList()
        => string.Join(", ", GetDisplayNames());
}
