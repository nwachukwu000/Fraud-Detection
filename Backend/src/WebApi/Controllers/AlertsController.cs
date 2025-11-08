using FDMA.Application.DTOs;
using FDMA.Application.Interfaces;
using FDMA.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AlertsController : ControllerBase
{
    private readonly IAlertService _alerts;
    public AlertsController(IAlertService alerts) => _alerts = alerts;

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] int? month = null, [FromQuery] AlertSeverity? severity = null, [FromQuery] AlertStatus? status = null, [FromQuery] string? ruleName = null)
    {
        var (items, total) = await _alerts.GetPagedAsync(page, pageSize, month, severity, status, ruleName);
        return Ok(new { total, items = items.Select(TransactionResponse.FromEntity) });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id) => 
        (await _alerts.GetByIdAsync(id)) is { } a ? Ok(a) : NotFound();

    [HttpPut("{id:guid}/resolve")]
    public async Task<IActionResult> Resolve(Guid id) { await _alerts.ResolveAsync(id); return NoContent(); }

    [HttpGet("top-accounts")]
    public async Task<IActionResult> TopAccounts([FromQuery] int topN = 10)
    {
        var res = await _alerts.GetTopAccountsAsync(topN);
        return Ok(res);
    }
}