using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Metadata;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TemplatesController(IImportService importService) : ControllerBase
{
    /// <summary>Download a pre-formatted Excel import template.</summary>
    [HttpGet("{entityType}")]
    public async Task<IActionResult> DownloadTemplate(string entityType, CancellationToken ct)
    {
        if (!Enum.TryParse<EntityType>(entityType, ignoreCase: true, out var et) || et == EntityType.Unknown)
            return BadRequest($"Invalid dataset. Valid datasets: {DatasetCatalog.GetValidDatasetList()}.");

        var bytes = await importService.GenerateTemplateAsync(et, ct);
        var label = DatasetCatalog.Get(et).FileNameFragment;
        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"CPQ_Dataset_Template_{label}.xlsx");
    }
}
