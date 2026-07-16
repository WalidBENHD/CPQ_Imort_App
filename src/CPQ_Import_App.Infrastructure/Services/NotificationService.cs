using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Repositories;

namespace CPQ_Import_App.Infrastructure.Services;

public interface INotificationService
{
    Task NotifyAdminsAboutPendingUserAsync(TestUser user, List<Guid> adminIds);
    Task NotifyUserApprovedAsync(Guid userId, string approverName);
    Task NotifyUserRoleChangedAsync(Guid userId, string oldRole, string newRole);
    Task NotifyImportUploadedAsync(ImportJob job, List<Guid> approverIds);
    Task NotifyImportNeedsCorrectionAsync(ImportJob job, Guid uploaderId);
    Task NotifyImportRejectedAsync(ImportJob job, Guid uploaderId);
    Task NotifyImportApprovedAsync(ImportJob job, Guid uploaderId);
    Task NotifyImportCommittedAsync(ImportJob job, Guid uploaderId);
}

public class NotificationService(
    INotificationRepository notificationRepository) : INotificationService
{
    private readonly INotificationRepository _notificationRepository = notificationRepository;

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

    public async Task NotifyImportUploadedAsync(ImportJob job, List<Guid> approverIds)
    {
        foreach (var approverId in approverIds)
        {
            var notification = new Notification
            {
                UserId = approverId,
                NotificationType = NotificationType.ImportUploaded,
                Title = "New Import Awaiting Approval",
                Message = $"Import '{job.OriginalFileName}' ({job.EntityType}) is ready for review.",
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
