using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly AppDbContext _db;
    
    public UsersController(UserManager<User> userManager, AppDbContext db)
    {
        _userManager = userManager;
        _db = db;
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] UserRequest req)
    {
        if (await _userManager.FindByEmailAsync(req.Email) is not null)
            return BadRequest(new { message = "Email already exists" });

        var user = new User
        {
            Id = Guid.NewGuid(),
            UserName = req.Email,
            Email = req.Email,
            FullName = req.FullName,
            Role = req.Role,
            CreatedAt = DateTime.UtcNow,
            EmailConfirmed = true
        };

        // Validate password
        if (string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Password is required" });

        if (req.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters long" });

        // Create user with the provided password
        var result = await _userManager.CreateAsync(user, req.Password);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = errors });
        }

        // Assign role to the user
        var roleResult = await _userManager.AddToRoleAsync(user, req.Role);
        if (!roleResult.Succeeded)
        {
            // If role assignment fails, delete the user and return error
            await _userManager.DeleteAsync(user);
            var errors = string.Join(", ", roleResult.Errors.Select(e => e.Description));
            return BadRequest(new { message = $"Failed to assign role: {errors}" });
        }

        return CreatedAtAction(nameof(GetById), new { id = user.Id }, UserResponse.FromEntity(user));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        
        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = errors });
        }
        
        return NoContent();
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UserUpdateRequest req)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        if (!string.IsNullOrEmpty(req.Email) && req.Email != user.Email)
        {
            user.Email = req.Email;
            user.UserName = req.Email;
        }
        if (!string.IsNullOrEmpty(req.FullName)) user.FullName = req.FullName;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = errors });
        }

        return Ok(UserResponse.FromEntity(user));
    }

    [HttpGet]
    [Authorize] // Allow all authenticated users to view the list, but only Admin can create/edit/delete
    public async Task<IActionResult> GetList([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? role = null)
    {
        var query = _userManager.Users.AsQueryable();
        
        if (!string.IsNullOrEmpty(role))
            query = query.Where(u => u.Role == role);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new { total, items = items.Select(UserResponse.FromEntity) });
    }

    [HttpGet("{id:guid}")]
    [Authorize] // Allow all authenticated users to view user details
    public async Task<IActionResult> GetById(Guid id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        return user is null ? NotFound() : Ok(UserResponse.FromEntity(user));
    }

    [HttpGet("roles")]
    [Authorize]
    public IActionResult GetRoles()
    {
        return Ok(new[] { "Admin", "Analyst", "Viewer" });
    }

    [HttpPost("{userId:guid}/roles")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddRole(Guid userId, [FromBody] RoleRequest req)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return NotFound();
        user.Role = req.Role;
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = errors });
        }
        return Ok(UserResponse.FromEntity(user));
    }

    [HttpPut("{userId:guid}/roles")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ChangeRole(Guid userId, [FromBody] RoleRequest req)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return NotFound();
        
        // Get current roles
        var currentRoles = await _userManager.GetRolesAsync(user);
        
        // Remove user from all current roles
        if (currentRoles.Any())
        {
            await _userManager.RemoveFromRolesAsync(user, currentRoles);
        }
        
        // Add user to new role
        var addRoleResult = await _userManager.AddToRoleAsync(user, req.Role);
        if (!addRoleResult.Succeeded)
        {
            var errors = string.Join(", ", addRoleResult.Errors.Select(e => e.Description));
            return BadRequest(new { message = errors });
        }
        
        // Update custom Role property
        user.Role = req.Role;
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = errors });
        }
        return Ok(UserResponse.FromEntity(user));
    }

    [HttpDelete("{userId:guid}/roles")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveRole(Guid userId)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return NotFound();
        user.Role = "Viewer"; // Default role
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = errors });
        }
        return NoContent();
    }
}

public record UserRequest(string Email, string FullName, string Role, string Password);
public record UserUpdateRequest(string? Email, string? FullName);
public record RoleRequest(string Role);

public record UserResponse(Guid Id, string Email, string FullName, string Role, DateTime CreatedAt)
{
    public static UserResponse FromEntity(User u) => new(u.Id, u.Email, u.FullName, u.Role, u.CreatedAt);
}
