using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Metadata;
using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.API.Mapping;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TemplatesController(IImportService importService) : ControllerBase
{
    [HttpGet("requirements")]
    public ActionResult<IReadOnlyList<DatasetRequirementDto>> GetDatasetRequirements()
        => Ok(DatasetCatalog.All.Select(x => x.ToDto()).ToList());

    [HttpGet("requirements/{entityType}")]
    public ActionResult<DatasetRequirementDto> GetDatasetRequirement(string entityType)
    {
        if (!Enum.TryParse<EntityType>(entityType, ignoreCase: true, out var et) || et == EntityType.Unknown)
            return BadRequest($"Invalid dataset. Valid datasets: {DatasetCatalog.GetValidDatasetList()}.");

        return Ok(DatasetCatalog.Get(et).ToDto());
    }

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
