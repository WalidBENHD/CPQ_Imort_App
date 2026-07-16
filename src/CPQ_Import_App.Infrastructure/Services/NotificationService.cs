using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Repositories;

namespace CPQ_Import_App.Infrastructure.Services;

public interface INotificationService
{
    Task NotifyAdminsAboutPendingUserAsync(TestUser user, List<Guid> adminIds);
    Task NotifyUserApprovedAsync(Guid userId, string approverName);
    Task NotifyUserRoleChangedAsync(Guid userId, string oldRole, string newRole);
    Task NotifyUserAccessChangedAsync(Guid userId, IReadOnlyCollection<string> addedRoles, IReadOnlyCollection<string> removedRoles, string changedBy);
    Task NotifyRoleCapabilitiesChangedAsync(IReadOnlyCollection<Guid> userIds, string roleName, string changedBy);
    Task NotifyImportUploadedAsync(ImportJob job, List<Guid> approverIds);
    Task NotifyImportNeedsCorrectionAsync(ImportJob job, Guid uploaderId);
    Task NotifyImportRejectedAsync(ImportJob job, Guid uploaderId);
    Task NotifyImportApprovedAsync(ImportJob job, Guid uploaderId);
    Task NotifyImportCommittedAsync(ImportJob job, Guid uploaderId);
    Task ClearImportNotificationsAsync(Guid importId);
}

public class NotificationService(
    INotificationRepository notificationRepository) : INotificationService
{
    private readonly INotificationRepository _notificationRepository = notificationRepository;

    public Task ClearImportNotificationsAsync(Guid importId)
        => _notificationRepository.DeleteForImportAsync(importId);

    public async Task NotifyAdminsAboutPendingUserAsync(TestUser user, List<Guid> adminIds)
    {
        foreach (var adminId in adminIds)
        {
            var notification = new Notification
            {
                UserId = adminId,
                NotificationType = NotificationType.UserPendingApproval,
                Title = "New User Pending Approval",
                Message = $"User '{user.DisplayName}' ({user.UserName}) is waiting for approval.",
                RelatedUserId = user.Id,
                ExpiresAt = DateTime.UtcNow.AddDays(7)
            };
            await _notificationRepository.CreateAsync(notification);
        }
    }

    public async Task NotifyUserApprovedAsync(Guid userId, string approverName)
    {
        var notification = new Notification
        {
            UserId = userId,
            NotificationType = NotificationType.UserApproved,
            Title = "Account Approved",
            Message = $"Your account has been approved by {approverName}.",
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };
        await _notificationRepository.CreateAsync(notification);
    }

    public async Task NotifyUserRoleChangedAsync(Guid userId, string oldRole, string newRole)
    {
        var notification = new Notification
        {
            UserId = userId,
            NotificationType = NotificationType.UserRoleChanged,
            Title = "Role Changed",
            Message = $"Your role has been changed from {oldRole} to {newRole}.",
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };
        await _notificationRepository.CreateAsync(notification);
    }

    public async Task NotifyUserAccessChangedAsync(
        Guid userId,
        IReadOnlyCollection<string> addedRoles,
        IReadOnlyCollection<string> removedRoles,
        string changedBy)
    {
        if (addedRoles.Count == 0 && removedRoles.Count == 0) return;

        var changes = new List<string>();
        if (addedRoles.Count > 0) changes.Add($"Added: {string.Join(", ", addedRoles)}.");
        if (removedRoles.Count > 0) changes.Add($"Removed: {string.Join(", ", removedRoles)}.");

        var notification = new Notification
        {
            UserId = userId,
            NotificationType = NotificationType.UserRoleChanged,
            Title = "Your access roles changed",
            Message = $"{string.Join(" ", changes)} Changed by {changedBy}. Your available actions have been updated.",
            RelatedUserId = userId,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };
        await _notificationRepository.CreateAsync(notification);
    }

    public async Task NotifyRoleCapabilitiesChangedAsync(IReadOnlyCollection<Guid> userIds, string roleName, string changedBy)
    {
        foreach (var userId in userIds.Distinct())
        {
            await _notificationRepository.CreateAsync(new Notification
            {
                UserId = userId,
                NotificationType = NotificationType.UserRoleChanged,
                Title = "Your role permissions changed",
                Message = $"The capabilities included in your {roleName} role were updated by {changedBy}. Your available actions may have changed.",
                RelatedUserId = userId,
                ExpiresAt = DateTime.UtcNow.AddDays(30)
            });
        }
    }

    public async Task NotifyImportUploadedAsync(ImportJob job, List<Guid> approverIds)
    {
        foreach (var approverId in approverIds)
        {
            var notification = new Notification
            {
                UserId = approverId,
                NotificationType = NotificationType.ImportUploaded,
                Title = "New Submission Waiting for Review",
                Message = $"{job.CreatedByDisplayName} submitted '{job.OriginalFileName}' ({job.EntityType}) for approval.",
                RelatedImportId = job.Id,
                ExpiresAt = DateTime.UtcNow.AddDays(7)
            };
            await _notificationRepository.CreateAsync(notification);
        }
    }

    public async Task NotifyImportNeedsCorrectionAsync(ImportJob job, Guid uploaderId)
    {
        var notification = new Notification
        {
            UserId = uploaderId,
            NotificationType = NotificationType.ImportNeedsCorrection,
            Title = "Import Needs Correction",
            Message = $"Errors were detected in '{job.OriginalFileName}'. Open the submission to correct the highlighted rows.",
            RelatedImportId = job.Id,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };
        await _notificationRepository.CreateAsync(notification);
    }

    public async Task NotifyImportRejectedAsync(ImportJob job, Guid uploaderId)
    {
        var notification = new Notification
        {
            UserId = uploaderId,
            NotificationType = NotificationType.ImportRejected,
            Title = "Import Rejected",
            Message = $"Your import '{job.OriginalFileName}' was rejected. Reason: {job.RejectionReason}",
            RelatedImportId = job.Id,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };
        await _notificationRepository.CreateAsync(notification);
    }

    public async Task NotifyImportApprovedAsync(ImportJob job, Guid uploaderId)
    {
        var notification = new Notification
        {
            UserId = uploaderId,
            NotificationType = NotificationType.ImportApproved,
            Title = "Import Ready for Publication",
            Message = $"Your import '{job.OriginalFileName}' has been approved. CPQ has not changed yet; the update is waiting for publication.",
            RelatedImportId = job.Id,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };
        await _notificationRepository.CreateAsync(notification);
    }

    public async Task NotifyImportCommittedAsync(ImportJob job, Guid uploaderId)
    {
        var notification = new Notification
        {
            UserId = uploaderId,
            NotificationType = NotificationType.ImportCommitted,
            Title = "Import Published",
            Message = $"Your import '{job.OriginalFileName}' has been published to CPQ. {job.CommittedRows} rows were written.",
            RelatedImportId = job.Id,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };
        await _notificationRepository.CreateAsync(notification);
    }
}
