using FDMA.Application.DTOs;
using FDMA.Application.Interfaces;
using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransactionsController : BaseController
{
    private readonly ITransactionService _service;
    private readonly AppDbContext _db;
    private readonly IEmailService? _emailService;
    public TransactionsController(ITransactionService service, AppDbContext db, IEmailService? emailService = null)
    {
        _service = service;
        _db = db;
        _emailService = emailService;
    }

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
            Email = req.Email,
            CreatedAt = DateTime.UtcNow,
            Status = "Normal" // Will be updated by CreateAsync based on risk score
        };
        var created = await _service.CreateAsync(t);
        
        CreateAuditLog(_db, "Transaction Created", "Transaction", created.Id, 
            $"Amount: {req.Amount}, Type: {req.TransactionType}");
        await _db.SaveChangesAsync();
        
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, TransactionResponse.FromEntity(created));
    }

    [HttpPut("{id:guid}/flag")]
    public async Task<IActionResult> Flag(Guid id, [FromQuery] bool isFlagged = true)
    {
        await _service.FlagAsync(id, isFlagged);
        
        CreateAuditLog(_db, isFlagged ? "Transaction Flagged" : "Transaction Unflagged", 
            "Transaction", id, $"Flagged: {isFlagged}");
        await _db.SaveChangesAsync();
        
        return NoContent();
    }

    [HttpPost("{id:guid}/resend-email")]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> ResendEmail(Guid id)
    {
        var transaction = await _service.GetByIdAsync(id);
        if (transaction is null)
            return NotFound(new { message = "Transaction not found" });

        if (!transaction.IsFlagged)
            return BadRequest(new { message = "Email can only be sent for flagged transactions" });

        if (string.IsNullOrWhiteSpace(transaction.Email))
            return BadRequest(new { message = "Transaction does not have an email address" });

        if (_emailService is null)
            return StatusCode(500, new { message = "Email service is not configured" });

        try
        {
            // Get admin emails
            List<string>? adminEmails = null;
            var adminUsers = _db.Set<User>()
                .Where(u => u.Role == "Admin" && !string.IsNullOrWhiteSpace(u.Email))
                .Select(u => u.Email!)
                .ToList();
            if (adminUsers.Any())
            {
                adminEmails = adminUsers;
            }

            await _emailService.SendFlaggedTransactionEmailAsync(
                transaction.Email,
                transaction.Id.ToString(),
                transaction.Amount,
                transaction.RiskScore,
                transaction.TransactionType,
                transaction.CreatedAt,
                transaction.Location,
                adminEmails
            );

            CreateAuditLog(_db, "Email Resent", "Transaction", id, 
                $"Email resent to {transaction.Email}");
            await _db.SaveChangesAsync();

            return Ok(new { message = "Email sent successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Failed to send email: {ex.Message}" });
        }
    }
}