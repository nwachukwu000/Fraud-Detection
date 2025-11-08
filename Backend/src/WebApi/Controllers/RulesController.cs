using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RulesController : ControllerBase
{
    private readonly AppDbContext _db;
    public RulesController(AppDbContext db) => _db = db;

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] RuleRequest req)
    {
        var rule = new Rule
        {
            Id = Guid.NewGuid(),
            Name = req.Name,
            Field = req.Field,
            Condition = req.Condition,
            Value = req.Value,
            IsEnabled = req.IsEnabled ?? true,
            CreatedAt = DateTime.UtcNow
        };
        _db.Rules.Add(rule);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = rule.Id }, rule);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] RuleRequest req)
    {
        var rule = await _db.Rules.FindAsync(id);
        if (rule is null) return NotFound();

        rule.Name = req.Name;
        rule.Field = req.Field;
        rule.Condition = req.Condition;
        rule.Value = req.Value;
        if (req.IsEnabled.HasValue) rule.IsEnabled = req.IsEnabled.Value;

        await _db.SaveChangesAsync();
        return Ok(rule);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var rule = await _db.Rules.FindAsync(id);
        if (rule is null) return NotFound();
        _db.Rules.Remove(rule);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet]
    public async Task<IActionResult> GetList()
    {
        var rules = await _db.Rules.OrderByDescending(r => r.CreatedAt).ToListAsync();
        return Ok(rules);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var rule = await _db.Rules.FindAsync(id);
        return rule is null ? NotFound() : Ok(rule);
    }

    [HttpPut("{id:guid}/toggle")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ToggleStatus(Guid id)
    {
        var rule = await _db.Rules.FindAsync(id);
        if (rule is null) return NotFound();
        rule.IsEnabled = !rule.IsEnabled;
        await _db.SaveChangesAsync();
        return Ok(new { isEnabled = rule.IsEnabled });
    }
}

public record RuleRequest(string Name, string Field, string Condition, string Value, bool? IsEnabled);
