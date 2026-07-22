using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Models;

public sealed record BusinessTraceScope(
    string Key,
    string Site,
    string ProductFamily,
    string Category,
    string Currency);

public sealed record BusinessTraceSuggestion(
    string Identifier,
    string Label,
    string? Detail,
    EntityType ObjectType,
    string ObjectTypeLabel);

public sealed record BusinessTraceField(
    string Key,
    string Label,
    string? Value,
    string? Hint,
    string Domain,
    string Kind);

public sealed record BusinessTraceSource(
    Guid JobId,
    string Dataset,
    string FileName,
    DateTime? PublishedAt,
    Guid? ReleasePackageId,
    string? ReleaseName);

public sealed record BusinessTraceActor(
    string Role,
    string DisplayName,
    DateTime? OccurredAt);

public sealed record BusinessTraceResponsibility(
    BusinessTraceActor? Prepared,
    BusinessTraceActor? Approved,
    BusinessTraceActor? Published,
    bool ApprovalEvidencePreserved);

public sealed record BusinessTraceChange(
    string Domain,
    string Field,
    string? Before,
    string? After);

public sealed record BusinessTraceEvent(
    string Id,
    string Kind,
    string Category,
    DateTime OccurredAt,
    string Title,
    string Summary,
    string ActorLabel,
    string Actor,
    Guid? SourceJobId,
    string SourceName,
    string SourceType,
    Guid? ReleasePackageId,
    string? ReleaseName,
    string? Decision,
    IReadOnlyList<BusinessTraceChange> Changes);

public sealed record BusinessTraceResult(
    BusinessTraceScope Scope,
    EntityType ObjectType,
    string ObjectTypeLabel,
    string Identifier,
    string? DisplayName,
    bool IsActive,
    string StatusLabel,
    DateTime? LastPublishedAt,
    DateTime? IntroducedAt,
    IReadOnlyList<BusinessTraceField> CurrentFields,
    IReadOnlyList<BusinessTraceSource> Sources,
    BusinessTraceResponsibility Responsibility,
    IReadOnlyList<BusinessTraceEvent> Events);
