using FDMA.Domain.Entities;
using FDMA.Domain.Enums;
using FDMA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CasesController : BaseController
{
    private readonly AppDbContext _db;
    public CasesController(AppDbContext db) => _db = db;

    [HttpPost]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> Create([FromBody] CaseRequest req)
    {
        // Verify transaction exists and has risk score > 0
        var transaction = await _db.Transactions.FindAsync(req.TransactionId);
        if (transaction is null)
            return BadRequest(new { message = "Transaction not found" });

        // Compute risk score to verify it's > 0
        var rules = await _db.Rules.Where(r => r.IsEnabled).ToListAsync();
        var riskScore = FDMA.Application.Services.RuleEngine.ComputeRiskScore(transaction, rules);
        
        if (riskScore <= 0)
            return BadRequest(new { message = "Cannot create case for transaction with risk score 0 or below" });

        var caseEntity = new Case
        {
            Id = Guid.NewGuid(),
            Title = req.Title,
            Description = req.Description,
            TransactionId = req.TransactionId,
            InvestigatorId = req.InvestigatorId,
            Status = CaseStatus.Open, // Pending/Open status on creation
            CreatedAt = DateTime.UtcNow
        };

        _db.Cases.Add(caseEntity);
        
        CreateAuditLog(_db, "Case Created", "Case", caseEntity.Id, 
            $"Title: {req.Title}, Transaction: {req.TransactionId}");
        await _db.SaveChangesAsync();
        
        return CreatedAtAction(nameof(GetById), new { id = caseEntity.Id }, CaseResponse.FromEntity(caseEntity));
    }

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] CaseStatus? status = null)
    {
        var query = _db.Cases.Include(c => c.Transaction).AsQueryable();
        
        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new { total, items = items.Select(CaseResponse.FromEntity) });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var caseEntity = await _db.Cases.Include(c => c.Transaction).FirstOrDefaultAsync(c => c.Id == id);
        return caseEntity is null ? NotFound() : Ok(CaseResponse.FromEntity(caseEntity));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CaseUpdateRequest req)
    {
        var caseEntity = await _db.Cases.FindAsync(id);
        if (caseEntity is null) return NotFound();

        if (!string.IsNullOrEmpty(req.Title)) caseEntity.Title = req.Title;
        if (req.Description != null) caseEntity.Description = req.Description;
        if (req.InvestigatorId.HasValue) caseEntity.InvestigatorId = req.InvestigatorId;
        if (req.Status.HasValue) caseEntity.Status = req.Status.Value;
        caseEntity.UpdatedAt = DateTime.UtcNow;

        CreateAuditLog(_db, "Case Updated", "Case", id, 
            $"Status: {caseEntity.Status}, Title: {caseEntity.Title}");
        await _db.SaveChangesAsync();
        
        return Ok(CaseResponse.FromEntity(caseEntity));
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] CaseStatusUpdateRequest req)
    {
        var caseEntity = await _db.Cases.FindAsync(id);
        if (caseEntity is null) return NotFound();

        caseEntity.Status = req.Status;
        caseEntity.UpdatedAt = DateTime.UtcNow;

        CreateAuditLog(_db, "Case Status Updated", "Case", id, 
            $"New Status: {req.Status}");
        await _db.SaveChangesAsync();
        
        return Ok(CaseResponse.FromEntity(caseEntity));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var caseEntity = await _db.Cases.FindAsync(id);
        if (caseEntity is null) return NotFound();
        
        CreateAuditLog(_db, "Case Deleted", "Case", id, 
            $"Title: {caseEntity.Title}");
        _db.Cases.Remove(caseEntity);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record CaseRequest(string Title, string? Description, Guid TransactionId, Guid? InvestigatorId);
public record CaseUpdateRequest(string? Title, string? Description, Guid? InvestigatorId, CaseStatus? Status);
public record CaseStatusUpdateRequest(CaseStatus Status);

public record CaseResponse(Guid Id, string Title, string? Description, Guid? TransactionId, Guid? InvestigatorId, CaseStatus Status, DateTime CreatedAt, DateTime? UpdatedAt)
{
    public static CaseResponse FromEntity(Case c) => new(c.Id, c.Title, c.Description, c.TransactionId, c.InvestigatorId, c.Status, c.CreatedAt, c.UpdatedAt);
}

