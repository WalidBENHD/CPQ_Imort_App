using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Core.Interfaces;

public interface IImportService
{
    Task<ImportJob> UploadAsync(Stream fileStream, string fileName, EntityType entityType,
        string userId, string userDisplayName, CancellationToken ct = default);
    Task<ImportJob> CopyToWorkspaceAsync(Guid sourceJobId, string fileName,
        string userId, string userDisplayName, CancellationToken ct = default);
    Task<ImportJob> RenameUploadAsync(Guid jobId, string name,
        string userId, string userDisplayName, CancellationToken ct = default);
    Task<ImportJob?> GetJobAsync(Guid jobId, CancellationToken ct = default);
    Task<(IReadOnlyList<ImportJob> Items, int Total)> GetJobsPagedAsync(
        int page, int pageSize, string viewerUserId, string? search = null, ImportStatus? status = null, EntityType? entityType = null, CancellationToken ct = default);
    Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsAsync(
        Guid jobId, int page, int pageSize, string? search = null, RowStatus? filterStatus = null, ComparisonStatus? comparisonStatus = null, CancellationToken ct = default);
    Task<ImportJob> RefreshValidationAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default);
    Task<DependencyContext> GetDependencyContextAsync(Guid jobId, string userId, CancellationToken ct = default);
    Task<DependencyImpact> PreviewDependencyAnchorAsync(Guid jobId, Guid articleMasterJobId, string userId, CancellationToken ct = default);
    Task<ImportJob> ApplyDependencyAnchorAsync(Guid jobId, Guid articleMasterJobId, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ReleasePackageSummary> CreateReleasePackageAsync(Guid jobId, Guid articleMasterJobId, string name, string userId, string userDisplayName, CancellationToken ct = default);
    Task DissolveReleasePackageAsync(Guid packageId, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ReleasePackageSummary> GetReleasePackageAsync(Guid packageId, string userId, bool canReview, CancellationToken ct = default);
    Task<ReleasePackageSummary> SubmitReleasePackageAsync(Guid packageId, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ReleasePackageSummary> ApproveReleasePackageAsync(Guid packageId, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ReleasePackageSummary> RejectReleasePackageAsync(Guid packageId, string userId, string userDisplayName, string reason, CancellationToken ct = default);
    Task<ReleasePackageSummary> PublishReleasePackageAsync(Guid packageId, string userId, string userDisplayName, CancellationToken ct = default);
    Task<StagingRow> UpdateStagingRowAsync(
        Guid jobId, Guid rowId, Dictionary<string, string?> fields, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ImportJob> AddStagingRowAsync(
        Guid jobId, Dictionary<string, string?> fields, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ImportJob> DeleteStagingRowsAsync(
        Guid jobId, IReadOnlyCollection<Guid> rowIds, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ImportJob> RestoreStagingRowsAsync(
        Guid jobId, IReadOnlyCollection<Guid> rowIds, string userId, string userDisplayName, CancellationToken ct = default);
    Task<IReadOnlyList<StagingRow>> GetDeletedStagingRowsAsync(Guid jobId, CancellationToken ct = default);
    Task<ImportJob> SubmitForReviewAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default, bool coordinatedRelease = false);
    Task<ImportJob> WithdrawFromReviewAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default);
    Task DeletePrivateDraftAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ImportJob> ApproveAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default, bool coordinatedRelease = false);
    Task<ImportJob> ReturnToReviewAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ImportJob> PublishAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ImportJob> CancelAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default);
    Task<ImportJob> RejectAsync(Guid jobId, string userId, string userDisplayName,
        string reason, CancellationToken ct = default);
    Task<ImportComparisonResult> GetComparisonAsync(Guid jobId, CancellationToken ct = default);
    Task<ApprovedComparisonSnapshot?> GetApprovedComparisonSnapshotAsync(Guid jobId, CancellationToken ct = default);
    Task<IReadOnlySet<string>> GetLatestApprovedArticleNumbersAsync(CancellationToken ct = default);
    Task<byte[]?> GetOriginalFileAsync(Guid jobId, CancellationToken ct = default);
    Task<byte[]> GenerateTemplateAsync(EntityType entityType, CancellationToken ct = default);
    Task<byte[]> GenerateErrorReportAsync(Guid jobId, CancellationToken ct = default);
    Task<byte[]> GenerateComparisonReportAsync(Guid jobId, CancellationToken ct = default);
    Task<DraftWorkingCopy> GenerateWorkingCopyAsync(Guid jobId, string userId, CancellationToken ct = default);
}

public interface IEvolisDecryptorService
{
    Task<string> DecryptAsync(Stream input, CancellationToken ct = default);
}
