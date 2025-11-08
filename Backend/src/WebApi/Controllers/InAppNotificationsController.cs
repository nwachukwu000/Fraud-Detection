using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InAppNotificationsController : ControllerBase
{
    private readonly AppDbContext _db;
    public InAppNotificationsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] bool? isRead = null, [FromQuery] bool? isUnread = null)
    {
        var query = _db.Notifications.AsQueryable();

        if (isRead.HasValue && isRead.Value)
            query = query.Where(n => n.MarkedAsRead);
        
        if (isUnread.HasValue && isUnread.Value)
            query = query.Where(n => !n.MarkedAsRead);

        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        return Ok(notifications);
    }

    [HttpPut("{id:guid}/mark-read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var notification = await _db.Notifications.FindAsync(id);
        if (notification is null) return NotFound();
        
        notification.MarkedAsRead = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:guid}/mark-unread")]
    public async Task<IActionResult> MarkAsUnread(Guid id)
    {
        var notification = await _db.Notifications.FindAsync(id);
        if (notification is null) return NotFound();
        
        notification.MarkedAsRead = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteSingle(Guid id)
    {
        var notification = await _db.Notifications.FindAsync(id);
        if (notification is null) return NotFound();
        
        _db.Notifications.Remove(notification);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteMultiple([FromBody] DeleteNotificationsRequest req)
    {
        var notifications = await _db.Notifications
            .Where(n => req.Ids.Contains(n.Id))
            .ToListAsync();
        
        _db.Notifications.RemoveRange(notifications);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record DeleteNotificationsRequest(List<Guid> Ids);
