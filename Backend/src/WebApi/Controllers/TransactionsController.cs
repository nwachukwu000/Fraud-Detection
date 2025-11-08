using FDMA.Application.DTOs;
using FDMA.Application.Interfaces;
using FDMA.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransactionsController : ControllerBase
{
    private readonly ITransactionService _service;
    public TransactionsController(ITransactionService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null, [FromQuery] string? account = null, [FromQuery] string? type = null,
        [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, [FromQuery] int? minRisk = null)
    {
        var (items, total) = await _service.GetPagedAsync(page, pageSize, status, account, type, from, to, minRisk);
        return Ok(new { total, items = items.Select(TransactionResponse.FromEntity) });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var t = await _service.GetByIdAsync(id);
        return t is null ? NotFound() : Ok(TransactionResponse.FromEntity(t));
    }

    [HttpGet("{id:guid}/details")]
    public async Task<IActionResult> GetDetails(Guid id)
    {
        var details = await _service.GetDetailsByIdAsync(id);
        return details is null ? NotFound() : Ok(details);
    }

    [HttpGet("account/{accountNumber}")]
    public async Task<IActionResult> GetByAccount(string accountNumber)
        => Ok((await _service.GetByAccountAsync(accountNumber)).Select(TransactionResponse.FromEntity));

    [HttpPost]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> Create([FromBody] TransactionRequest req)
    {
        var t = new Transaction
        {
            Id = Guid.NewGuid(),
            SenderAccountNumber = req.SenderAccountNumber,
            ReceiverAccountNumber = req.ReceiverAccountNumber,
            TransactionType = req.TransactionType,
            Amount = req.Amount,
            Location = req.Location,
            Device = req.Device,
            IpAddress = req.IpAddress,
            CreatedAt = DateTime.UtcNow,
            Status = "Completed"
        };
        var created = await _service.CreateAsync(t);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, TransactionResponse.FromEntity(created));
    }

    [HttpPut("{id:guid}/flag")]
    public async Task<IActionResult> Flag(Guid id, [FromQuery] bool isFlagged = true)
    {
        await _service.FlagAsync(id, isFlagged);
        return NoContent();
    }
}