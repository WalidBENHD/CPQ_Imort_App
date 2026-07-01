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
    string FileNameFragment);

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
            "Product_Master"),
        [EntityType.PriceList] = new(
            EntityType.PriceList,
            "Pricing Conditions",
            "Pricing Operations",
            "Pricing Conditions Template",
            "Active",
            "v4.1",
            "Commercial prices and validity windows controlled by the pricing team.",
            "Pricing_Conditions"),
        [EntityType.Description] = new(
            EntityType.Description,
            "Product Texts",
            "Localization Team",
            "Product Texts Template",
            "Active",
            "v2.5",
            "Localized descriptions and content aligned across all international sites.",
            "Product_Texts"),
        [EntityType.CurrencyRate] = new(
            EntityType.CurrencyRate,
            "Exchange Rates",
            "Finance Operations",
            "Exchange Rates Template",
            "Monitored",
            "v1.8",
            "Currency conversion references used for international pricing updates.",
            "Exchange_Rates")
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
                entityType.ToString());

    public static IReadOnlyList<string> GetDisplayNames()
        => All.Select(d => d.DisplayName).ToList();

    public static string GetValidDatasetList()
        => string.Join(", ", GetDisplayNames());
}
