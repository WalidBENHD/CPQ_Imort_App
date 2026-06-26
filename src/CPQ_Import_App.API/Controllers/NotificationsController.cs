using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController(INotificationRepository notificationRepository) : ControllerBase
{
    private readonly INotificationRepository _notificationRepository = notificationRepository;

    private Guid CurrentUserId
    {
        get
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            return userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId) 
                ? userId 
                : Guid.Empty;
        }
    }

    /// <summary>
    /// Get current user's notifications
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<object>> GetNotifications([FromQuery] int pageSize = 20, [FromQuery] int skip = 0)
    {
        var userId = CurrentUserId;
        if (userId == Guid.Empty)
            return Unauthorized();

        var notifications = await _notificationRepository.GetUserNotificationsAsync(userId, pageSize, skip);
        var unreadCount = await _notificationRepository.GetUnreadCountAsync(userId);

        return Ok(new { notifications, unreadCount });
    }

    /// <summary>
    /// Get unread notification count
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<ActionResult<int>> GetUnreadCount()
    {
        var userId = CurrentUserId;
        if (userId == Guid.Empty)
            return Unauthorized();

        var count = await _notificationRepository.GetUnreadCountAsync(userId);
        return Ok(count);
    }

    /// <summary>
    /// Mark notification as read
    /// </summary>
    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        await _notificationRepository.MarkAsReadAsync(id);
        return NoContent();
    }

    /// <summary>
    /// Mark all notifications as read
    /// </summary>
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = CurrentUserId;
        if (userId == Guid.Empty)
            return Unauthorized();

        await _notificationRepository.MarkAllAsReadAsync(userId);
        return NoContent();
    }

    /// <summary>
    /// Delete a notification
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNotification(Guid id)
    {
        await _notificationRepository.DeleteAsync(id);
        return NoContent();
    }
}
