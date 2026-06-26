using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.Infrastructure.Repositories;

public interface INotificationRepository
{
    Task<Notification> CreateAsync(Notification notification);
    Task<List<Notification>> GetUserNotificationsAsync(Guid userId, int pageSize = 20, int skip = 0);
    Task<int> GetUnreadCountAsync(Guid userId);
    Task MarkAsReadAsync(Guid notificationId);
    Task MarkAllAsReadAsync(Guid userId);
    Task DeleteAsync(Guid notificationId);
    Task DeleteExpiredAsync();
}

public class NotificationRepository(AppDbContext db) : INotificationRepository
{
    public async Task<Notification> CreateAsync(Notification notification)
    {
        db.Notifications.Add(notification);
        await db.SaveChangesAsync();
        return notification;
    }

    public async Task<List<Notification>> GetUserNotificationsAsync(Guid userId, int pageSize = 20, int skip = 0)
    {
        return await db.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Skip(skip)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        return await db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .CountAsync();
    }

    public async Task MarkAsReadAsync(Guid notificationId)
    {
        var notification = await db.Notifications.FindAsync(notificationId);
        if (notification != null)
        {
            notification.IsRead = true;
            await db.SaveChangesAsync();
        }
    }

    public async Task MarkAllAsReadAsync(Guid userId)
    {
        await db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
    }

    public async Task DeleteAsync(Guid notificationId)
    {
        await db.Notifications
            .Where(n => n.Id == notificationId)
            .ExecuteDeleteAsync();
    }

    public async Task DeleteExpiredAsync()
    {
        await db.Notifications
            .Where(n => n.ExpiresAt.HasValue && n.ExpiresAt < DateTime.UtcNow)
            .ExecuteDeleteAsync();
    }
}
