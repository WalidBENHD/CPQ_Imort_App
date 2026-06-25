using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TemplatesController(IImportService importService) : ControllerBase
{
    private static readonly Dictionary<string, string> EntityTypeLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Article"] = "Articles",
        ["PriceList"] = "PriceLists",
        ["Description"] = "Descriptions",
        ["CurrencyRate"] = "CurrencyRates"
    };

    /// <summary>Download a pre-formatted Excel import template.</summary>
    [HttpGet("{entityType}")]
    public async Task<IActionResult> DownloadTemplate(string entityType, CancellationToken ct)
    {
        if (!Enum.TryParse<EntityType>(entityType, ignoreCase: true, out var et) || et == EntityType.Unknown)
            return BadRequest($"Invalid entity type. Valid values: {string.Join(", ", EntityTypeLabels.Keys)}.");

        var bytes = await importService.GenerateTemplateAsync(et, ct);
        var label = EntityTypeLabels.GetValueOrDefault(entityType, entityType);
        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"CPQ_Import_Template_{label}.xlsx");
    }
}
