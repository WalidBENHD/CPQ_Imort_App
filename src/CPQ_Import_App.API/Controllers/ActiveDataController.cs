using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.API.Security;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Metadata;
using CPQ_Import_App.Core.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/active-data")]
[Authorize(Policy = Capabilities.ImportsView)]
public sealed class ActiveDataController(IActiveDatasetReader activeDatasetReader) : ControllerBase
{
    [HttpGet("{entityType}")]
    public async Task<ActionResult<IReadOnlyList<ActiveDatasetRecordDto>>> GetRecords(
        string entityType,
        CancellationToken ct)
    {
        if (!Enum.TryParse<EntityType>(entityType, true, out var parsedEntityType)
            || parsedEntityType == EntityType.Unknown
            || !DatasetCatalog.IsSupported(parsedEntityType))
        {
            return BadRequest(new
            {
                error = $"Invalid dataset '{entityType}'. Valid datasets: {DatasetCatalog.GetValidDatasetList()}."
            });
        }

        var records = await activeDatasetReader.GetRecordsAsync(parsedEntityType, ct);
        return Ok(records.Select(record => new ActiveDatasetRecordDto(
            record.Key,
            record.EntityType,
            record.Fields)));
    }
}
