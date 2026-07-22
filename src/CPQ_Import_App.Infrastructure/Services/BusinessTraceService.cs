using System.Globalization;
using System.Text.Json;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Metadata;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.Infrastructure.Services;

public sealed class BusinessTraceService(AppDbContext db) : IBusinessTraceService
{
    public const string PilotScopeKey = "saint-marcellin-pdu";

    private static readonly BusinessTraceScope PilotScope = new(
        PilotScopeKey,
        "Saint-Marcellin",
        "PDU",
        "Standard",
        "EUR");

    private static readonly EntityType[] ArticleDomains =
        [EntityType.Article, EntityType.PriceList, EntityType.Description];

    public async Task<IReadOnlyList<BusinessTraceSuggestion>> GetSuggestionsAsync(
        string scopeKey,
        EntityType objectType,
        int limit = 6,
        CancellationToken ct = default)
    {
        ValidateRequest(scopeKey, objectType);
        limit = Math.Clamp(limit, 1, 20);

        var datasetType = objectType == EntityType.PriceList ? EntityType.PriceList : EntityType.Article;
        var activeJobId = await db.ImportJobs.AsNoTracking()
            .Where(job => job.Status == ImportStatus.Committed && job.EntityType == datasetType)
            .OrderByDescending(job => job.CommittedAt)
            .ThenByDescending(job => job.CreatedAt)
            .Select(job => (Guid?)job.Id)
            .FirstOrDefaultAsync(ct);

        if (!activeJobId.HasValue)
            return [];

        var rawRows = await db.StagingRows.AsNoTracking()
            .Where(row => row.ImportJobId == activeJobId.Value && !row.IsDeleted)
            .OrderBy(row => row.RowNumber)
            .Select(row => row.RawData)
            .ToListAsync(ct);

        return rawRows
            .Select(Deserialize)
            .Select(fields => new
            {
                Identifier = Get(fields, "ArticleNumber")?.Trim(),
                Label = datasetType == EntityType.Article
                    ? Get(fields, "Name")?.Trim()
                    : Get(fields, "UnitPrice")?.Trim() ?? Get(fields, "Price")?.Trim(),
                Detail = datasetType == EntityType.Article
                    ? Get(fields, "Category")?.Trim()
                    : JoinNonEmpty(Get(fields, "Currency"), Get(fields, "ValidFrom"))
            })
            .Where(item => !string.IsNullOrWhiteSpace(item.Identifier))
            .GroupBy(item => item.Identifier!, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .Take(limit)
            .Select(item => new BusinessTraceSuggestion(
                item.Identifier!,
                item.Label ?? item.Identifier!,
                item.Detail,
                objectType,
                ObjectTypeLabel(objectType)))
            .ToList();
    }

    public async Task<BusinessTraceResult?> SearchAsync(
        string scopeKey,
        EntityType objectType,
        string identifier,
        CancellationToken ct = default)
    {
        ValidateRequest(scopeKey, objectType);
        identifier = identifier.Trim();
        if (string.IsNullOrWhiteSpace(identifier))
            throw new InvalidDataException("Provide an article identifier to trace.");

        var jobs = await db.ImportJobs.AsNoTracking()
            .Include(job => job.ReleasePackage)
            .Where(job => job.Status == ImportStatus.Committed && ArticleDomains.Contains(job.EntityType))
            .OrderBy(job => job.CommittedAt)
            .ThenBy(job => job.CreatedAt)
            .ToListAsync(ct);

        if (jobs.Count == 0)
            return null;

        var jobIds = jobs.Select(job => job.Id).ToList();
        var rows = await db.StagingRows.AsNoTracking()
            .Where(row => jobIds.Contains(row.ImportJobId) && !row.IsDeleted)
            .Select(row => new TraceRow(row.ImportJobId, row.RawData))
            .ToListAsync(ct);

        var rowsByJob = rows.GroupBy(row => row.JobId).ToDictionary(group => group.Key, group => group.ToList());
        var impacts = BuildImpacts(jobs, rowsByJob, identifier);
        var everExisted = impacts.Any(impact => impact.Before.Count > 0 || impact.After.Count > 0);
        if (!everExisted)
            return null;

        var activeJobs = jobs
            .GroupBy(job => job.EntityType)
            .ToDictionary(group => group.Key, group => group.Last());
        var currentStates = activeJobs.ToDictionary(
            pair => pair.Key,
            pair => ExtractState(pair.Key, rowsByJob.GetValueOrDefault(pair.Value.Id) ?? [], identifier));

        var isActive = currentStates.GetValueOrDefault(EntityType.Article)?.Count > 0;
        var currentFields = BuildCurrentFields(objectType, currentStates);
        var sources = BuildSources(activeJobs, currentStates);
        var events = BuildEvents(impacts);
        var latestSource = sources.OrderByDescending(source => source.PublishedAt).FirstOrDefault();
        var latestJob = latestSource is null ? null : jobs.FirstOrDefault(job => job.Id == latestSource.JobId);
        var responsibility = BuildResponsibility(latestJob);
        var articleState = currentStates.GetValueOrDefault(EntityType.Article) ?? [];
        var displayName = Get(articleState, "Name") ?? identifier;

        return new BusinessTraceResult(
            PilotScope,
            objectType,
            ObjectTypeLabel(objectType),
            identifier,
            displayName,
            isActive,
            isActive ? "Active in CPQ" : "Not active in CPQ",
            events.Where(item => item.Kind is "published" or "introduced" or "removed")
                .Select(item => (DateTime?)item.OccurredAt).FirstOrDefault(),
            events.Where(item => item.Kind == "introduced")
                .OrderBy(item => item.OccurredAt)
                .Select(item => (DateTime?)item.OccurredAt).FirstOrDefault(),
            currentFields,
            sources,
            responsibility,
            events);
    }

    private static List<JobImpact> BuildImpacts(
        IReadOnlyList<ImportJob> jobs,
        IReadOnlyDictionary<Guid, List<TraceRow>> rowsByJob,
        string identifier)
    {
        var impacts = new List<JobImpact>();
        foreach (var domain in ArticleDomains)
        {
            IReadOnlyDictionary<string, string?> previous = new Dictionary<string, string?>();
            foreach (var job in jobs.Where(item => item.EntityType == domain))
            {
                var current = ExtractState(domain, rowsByJob.GetValueOrDefault(job.Id) ?? [], identifier);
                if (!StatesEqual(previous, current))
                    impacts.Add(new JobImpact(job, previous, current, BuildChanges(domain, previous, current)));
                previous = current;
            }
        }

        return impacts;
    }

    private static List<BusinessTraceEvent> BuildEvents(IReadOnlyList<JobImpact> impacts)
    {
        var events = new List<BusinessTraceEvent>();
        var groups = impacts.GroupBy(impact => impact.Job.ReleasePackageId?.ToString("D") ?? impact.Job.Id.ToString("D"));
        foreach (var group in groups)
        {
            var groupImpacts = group.OrderBy(impact => impact.Job.EntityType).ToList();
            var jobs = groupImpacts.Select(impact => impact.Job).DistinctBy(job => job.Id).ToList();
            var package = jobs.Select(job => job.ReleasePackage).FirstOrDefault(item => item is not null);
            var primary = jobs.OrderByDescending(job => job.CommittedAt).First();
            var publishedAt = package?.PublishedAt ?? primary.CommittedAt ?? primary.CreatedAt;
            var sourceName = string.Join(" + ", jobs.Select(job => Path.GetFileNameWithoutExtension(job.OriginalFileName)).Distinct());
            var sourceType = string.Equals(Path.GetExtension(primary.FileName), ".hmi", StringComparison.OrdinalIgnoreCase)
                ? "maintenance"
                : "upload";
            var releaseName = package?.Name;
            var releaseId = package?.Id;
            var changes = groupImpacts.SelectMany(impact => impact.Changes).ToList();

            var articleImpact = groupImpacts.FirstOrDefault(impact => impact.Job.EntityType == EntityType.Article);
            var kind = articleImpact is { Before.Count: 0, After.Count: > 0 }
                ? "introduced"
                : articleImpact is { Before.Count: > 0, After.Count: 0 }
                    ? "removed"
                    : "published";
            var title = kind switch
            {
                "introduced" => "Article introduced into the governed portfolio",
                "removed" => "Article removed from the governed portfolio",
                _ when jobs.Count > 1 => "Coordinated portfolio values published to CPQ",
                _ when primary.EntityType == EntityType.PriceList => "Basis price values published to CPQ",
                _ when primary.EntityType == EntityType.Description => "Article descriptions published to CPQ",
                _ => "Article Master values published to CPQ"
            };

            events.Add(new BusinessTraceEvent(
                $"publish-{group.Key}",
                kind,
                "changes",
                publishedAt,
                title,
                jobs.Count > 1
                    ? "The approved coordinated release became active in CPQ as one governed publication."
                    : $"The approved {DatasetCatalog.Get(primary.EntityType).DisplayName} became active in CPQ.",
                "Published by",
                package?.PublishedByDisplayName ?? primary.CommittedBy ?? "Unknown user",
                primary.Id,
                sourceName,
                sourceType,
                releaseId,
                releaseName,
                null,
                changes));

            var approvedAt = package?.ApprovedAt ?? jobs.Max(job => job.ApprovedAt);
            if (approvedAt.HasValue)
            {
                events.Add(new BusinessTraceEvent(
                    $"approve-{group.Key}",
                    "approved",
                    "decisions",
                    approvedAt.Value,
                    releaseId.HasValue ? "Release approved for publication" : "Dataset approved for publication",
                    "The approver accepted the exact comparison preserved with this publication.",
                    "Approved by",
                    package?.ApprovedByDisplayName ?? primary.ApprovedByDisplayName ?? "Unknown approver",
                    primary.Id,
                    sourceName,
                    sourceType,
                    releaseId,
                    releaseName,
                    BuildApprovalDecision(jobs),
                    []));
            }

            var submittedAt = package?.SubmittedAt ?? jobs.Max(job => job.SubmittedAt);
            if (submittedAt.HasValue)
            {
                events.Add(new BusinessTraceEvent(
                    $"submit-{group.Key}",
                    "submitted",
                    "decisions",
                    submittedAt.Value,
                    releaseId.HasValue ? "Coordinated release submitted for review" : "Dataset submitted for review",
                    releaseId.HasValue
                        ? "The related datasets were locked together and shared with approvers."
                        : "The prepared dataset was shared with approvers for a governed decision.",
                    "Submitted by",
                    package?.SubmittedByDisplayName ?? primary.SubmittedByDisplayName ?? primary.CreatedByDisplayName,
                    primary.Id,
                    sourceName,
                    sourceType,
                    releaseId,
                    releaseName,
                    null,
                    []));
            }
        }

        return events
            .OrderByDescending(item => item.OccurredAt)
            .ThenBy(item => EventOrder(item.Kind))
            .ToList();
    }

    private static IReadOnlyList<BusinessTraceChange> BuildChanges(
        EntityType domain,
        IReadOnlyDictionary<string, string?> before,
        IReadOnlyDictionary<string, string?> after)
    {
        return before.Keys.Concat(after.Keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(key => !key.Equals("ArticleNumber", StringComparison.OrdinalIgnoreCase))
            .Where(key => !ValuesEqual(before.GetValueOrDefault(key), after.GetValueOrDefault(key)))
            .OrderBy(FieldOrder)
            .Select(key => new BusinessTraceChange(
                DatasetCatalog.Get(domain).DisplayName,
                DisplayField(key),
                before.GetValueOrDefault(key),
                after.GetValueOrDefault(key)))
            .ToList();
    }

    private static List<BusinessTraceField> BuildCurrentFields(
        EntityType objectType,
        IReadOnlyDictionary<EntityType, Dictionary<string, string?>> states)
    {
        var article = states.GetValueOrDefault(EntityType.Article) ?? [];
        var price = states.GetValueOrDefault(EntityType.PriceList) ?? [];
        var descriptions = states.GetValueOrDefault(EntityType.Description) ?? [];
        var fields = new List<BusinessTraceField>();

        void Add(IReadOnlyDictionary<string, string?> source, string key, string domain, string kind = "text", string? hint = null)
        {
            var value = Get(source, key);
            if (!string.IsNullOrWhiteSpace(value))
                fields.Add(new BusinessTraceField(key, DisplayField(key), value, hint ?? domain, domain, kind));
        }

        if (objectType == EntityType.PriceList)
        {
            Add(price, "UnitPrice", "Basis Price", "price", JoinNonEmpty(Get(price, "Currency"), Get(article, "Unit")));
            Add(price, "ValidFrom", "Basis Price");
            Add(price, "ValidTo", "Basis Price");
            Add(article, "Name", "Article Master");
        }
        else
        {
            Add(article, "Name", "Article Master");
            Add(price, "UnitPrice", "Basis Price", "price", JoinNonEmpty(Get(price, "Currency"), Get(article, "Unit")));
            Add(article, "Category", "Article Master");
            Add(article, "Unit", "Article Master");
            Add(price, "ValidFrom", "Basis Price");
            Add(price, "ValidTo", "Basis Price");
        }

        foreach (var pair in descriptions.Where(pair => pair.Key.Contains("Description", StringComparison.OrdinalIgnoreCase)))
            fields.Add(new BusinessTraceField(pair.Key, DisplayField(pair.Key), pair.Value, "Article Descriptions", "Article Descriptions", "text"));

        return fields;
    }

    private static List<BusinessTraceSource> BuildSources(
        IReadOnlyDictionary<EntityType, ImportJob> activeJobs,
        IReadOnlyDictionary<EntityType, Dictionary<string, string?>> currentStates)
    {
        return activeJobs
            .Where(pair => currentStates.GetValueOrDefault(pair.Key)?.Count > 0)
            .OrderBy(pair => Array.IndexOf(ArticleDomains, pair.Key))
            .Select(pair => new BusinessTraceSource(
                pair.Value.Id,
                DatasetCatalog.Get(pair.Key).DisplayName,
                Path.GetFileNameWithoutExtension(pair.Value.OriginalFileName),
                pair.Value.CommittedAt,
                pair.Value.ReleasePackageId,
                pair.Value.ReleasePackage?.Name))
            .ToList();
    }

    private static BusinessTraceResponsibility BuildResponsibility(ImportJob? job)
    {
        if (job is null)
            return new BusinessTraceResponsibility(null, null, null, false);

        var package = job.ReleasePackage;
        return new BusinessTraceResponsibility(
            new BusinessTraceActor("Prepared by", job.CreatedByDisplayName, job.CreatedAt),
            !string.IsNullOrWhiteSpace(package?.ApprovedByDisplayName ?? job.ApprovedByDisplayName)
                ? new BusinessTraceActor("Approved by", package?.ApprovedByDisplayName ?? job.ApprovedByDisplayName!, package?.ApprovedAt ?? job.ApprovedAt)
                : null,
            !string.IsNullOrWhiteSpace(package?.PublishedByDisplayName ?? job.CommittedBy)
                ? new BusinessTraceActor("Published by", package?.PublishedByDisplayName ?? job.CommittedBy!, package?.PublishedAt ?? job.CommittedAt)
                : null,
            !string.IsNullOrWhiteSpace(package?.ApprovalEvidenceJson ?? job.ApprovedComparisonJson));
    }

    private static Dictionary<string, string?> ExtractState(
        EntityType domain,
        IEnumerable<TraceRow> rows,
        string identifier)
    {
        var matches = rows.Select(row => Deserialize(row.RawData))
            .Where(fields => string.Equals(Get(fields, "ArticleNumber")?.Trim(), identifier, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (matches.Count == 0)
            return [];
        if (matches.Count == 1)
            return NormalizeState(matches[0]);

        var flattened = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["ArticleNumber"] = identifier
        };
        foreach (var row in matches)
        {
            var qualifier = domain switch
            {
                EntityType.Description => Get(row, "LanguageCode"),
                EntityType.PriceList => JoinNonEmpty(Get(row, "Currency"), Get(row, "ValidFrom")),
                _ => null
            };
            foreach (var pair in NormalizeState(row).Where(pair => !pair.Key.Equals("ArticleNumber", StringComparison.OrdinalIgnoreCase)))
                flattened[string.IsNullOrWhiteSpace(qualifier) ? pair.Key : $"{pair.Key} ({qualifier})"] = pair.Value;
        }
        return flattened;
    }

    private static Dictionary<string, string?> NormalizeState(IReadOnlyDictionary<string, string?> source)
    {
        var result = new Dictionary<string, string?>(source, StringComparer.OrdinalIgnoreCase);
        if (!result.ContainsKey("UnitPrice") && result.TryGetValue("Price", out var legacyPrice))
            result["UnitPrice"] = legacyPrice;
        result.Remove("Price");
        return result;
    }

    private static string BuildApprovalDecision(IEnumerable<ImportJob> jobs)
    {
        var snapshots = jobs.Select(job => DeserializeApproval(job.ApprovedComparisonJson)).Where(item => item is not null).ToList();
        if (snapshots.Count == 0)
            return "Approval evidence is preserved with this publication.";
        var added = snapshots.Sum(item => item!.Comparison.NewRows);
        var modified = snapshots.Sum(item => item!.Comparison.ModifiedRows);
        var removed = snapshots.Sum(item => item!.Comparison.MissingBaselineRows);
        return $"Approved impact: {added} new, {modified} modified, and {removed} scoped removals.";
    }

    private static ApprovedComparisonSnapshot? DeserializeApproval(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<ApprovedComparisonSnapshot>(json, JsonOptions); }
        catch (JsonException) { return null; }
    }

    private static Dictionary<string, string?> Deserialize(string json)
        => JsonSerializer.Deserialize<Dictionary<string, string?>>(json, JsonOptions)
           ?? new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

    private static string? Get(IReadOnlyDictionary<string, string?> fields, string key)
        => fields.TryGetValue(key, out var value) ? value : null;

    private static bool StatesEqual(IReadOnlyDictionary<string, string?> left, IReadOnlyDictionary<string, string?> right)
        => left.Keys.Concat(right.Keys).Distinct(StringComparer.OrdinalIgnoreCase)
            .All(key => ValuesEqual(left.GetValueOrDefault(key), right.GetValueOrDefault(key)));

    private static bool ValuesEqual(string? left, string? right)
        => string.Equals(left?.Trim() ?? string.Empty, right?.Trim() ?? string.Empty, StringComparison.OrdinalIgnoreCase);

    private static string DisplayField(string key)
    {
        var qualifierIndex = key.IndexOf(" (", StringComparison.Ordinal);
        var baseKey = qualifierIndex > 0 ? key[..qualifierIndex] : key;
        var qualifier = qualifierIndex > 0 ? key[qualifierIndex..] : string.Empty;
        return (baseKey switch
        {
            "Name" => "Article name",
            "UnitPrice" => "Basis price",
            "ValidFrom" => "Valid from",
            "ValidTo" => "Valid to",
            "LanguageCode" => "Language",
            "ShortDescription" => "Short description",
            "LongDescription" => "Long description",
            _ => string.Concat(baseKey.Select((character, index) => index > 0 && char.IsUpper(character) ? $" {character}" : character.ToString()))
        }) + qualifier;
    }

    private static int FieldOrder(string key) => key switch
    {
        "Name" => 1,
        "UnitPrice" => 2,
        "Category" => 3,
        "Unit" => 4,
        "Currency" => 5,
        "ValidFrom" => 6,
        "ValidTo" => 7,
        _ => 20
    };

    private static int EventOrder(string kind) => kind switch
    {
        "published" or "introduced" or "removed" => 0,
        "approved" => 1,
        _ => 2
    };

    private static string ObjectTypeLabel(EntityType objectType)
        => objectType == EntityType.PriceList ? "Basis price" : "Article";

    private static string? JoinNonEmpty(params string?[] values)
    {
        var present = values.Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!.Trim()).ToList();
        return present.Count == 0 ? null : string.Join(" · ", present);
    }

    private static void ValidateRequest(string scopeKey, EntityType objectType)
    {
        if (!string.Equals(scopeKey, PilotScopeKey, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("The selected scope is not available.");
        if (objectType is not EntityType.Article and not EntityType.PriceList)
            throw new InvalidDataException("Business Trace currently supports Article and Basis Price objects.");
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private sealed record TraceRow(Guid JobId, string RawData);
    private sealed record JobImpact(
        ImportJob Job,
        IReadOnlyDictionary<string, string?> Before,
        IReadOnlyDictionary<string, string?> After,
        IReadOnlyList<BusinessTraceChange> Changes);
}
