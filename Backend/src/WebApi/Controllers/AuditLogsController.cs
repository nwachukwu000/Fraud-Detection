using FDMA.Application.DTOs;
using FDMA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuditLogsController : ControllerBase
{
    private readonly AppDbContext _db;
    public AuditLogsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] int page = 1, [FromQuery] int pageSize = 50,
        [FromQuery] string? entityType = null, [FromQuery] Guid? entityId = null)
    {
        var query = _db.AuditLogs.AsQueryable();

        if (!string.IsNullOrEmpty(entityType))
            query = query.Where(a => a.EntityType == entityType);

        if (entityId.HasValue)
            query = query.Where(a => a.EntityId == entityId.Value);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new { total, items = items.Select(AuditLogResponse.FromEntity) });
    }

    [HttpGet("entity/{entityType}/{entityId:guid}")]
    public async Task<IActionResult> GetByEntity(string entityType, Guid entityId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var query = _db.AuditLogs
            .Where(a => a.EntityType == entityType && a.EntityId == entityId);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new { total, items = items.Select(AuditLogResponse.FromEntity) });
    }
}

