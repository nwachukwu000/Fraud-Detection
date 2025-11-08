using FDMA.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class AuthsController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly IConfiguration _configuration;

    public AuthsController(
        UserManager<User> userManager,
        SignInManager<User> signInManager,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await _userManager.FindByEmailAsync(req.Email);
        if (user is null)
            return Unauthorized(new { message = "Invalid credentials" });

        var result = await _signInManager.CheckPasswordSignInAsync(user, req.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            if (result.IsLockedOut)
                return Unauthorized(new { message = "Account is locked out. Please try again later." });
            return Unauthorized(new { message = "Invalid credentials" });
        }

        var token = await GenerateJwtToken(user);
        return Ok(new
        {
            token,
            user = new { user.Id, user.Email, user.FullName, user.Role }
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (await _userManager.FindByEmailAsync(req.Email) is not null)
            return BadRequest(new { message = "Email already exists" });

        var user = new User
        {
            Id = Guid.NewGuid(),
            UserName = req.Email,
            Email = req.Email,
            FullName = req.FullName,
            Role = "Viewer", // Default role
            CreatedAt = DateTime.UtcNow,
            EmailConfirmed = true // For development - in production, require email confirmation
        };

        var result = await _userManager.CreateAsync(user, req.Password);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = errors });
        }

        // Assign default role to new user
        await _userManager.AddToRoleAsync(user, user.Role);

        var token = await GenerateJwtToken(user);
        return Ok(new
        {
            token,
            user = new { user.Id, user.Email, user.FullName, user.Role }
        });
    }

    [HttpPost("confirm-email")]
    public IActionResult ConfirmEmail([FromBody] ConfirmEmailRequest req)
    {
        // Mock email confirmation
        return Ok(new { message = "Email confirmed successfully" });
    }

    [HttpPost("forgot-password")]
    public IActionResult ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        // Mock forgot password - would send reset email in production
        return Ok(new { message = "Password reset email sent" });
    }

    [HttpPost("reset-password")]
    public IActionResult ResetPassword([FromBody] ResetPasswordRequest req)
    {
        // Mock password reset
        return Ok(new { message = "Password reset successfully" });
    }

    [HttpPost("create-admin")]
    [AllowAnonymous] // Allow this for initial setup - remove in production or add IP restriction
    public async Task<IActionResult> CreateAdmin()
    {
        var adminEmail = "admin@fraudguard.com";
        var existingAdmin = await _userManager.FindByEmailAsync(adminEmail);
        
        if (existingAdmin != null)
        {
            return BadRequest(new { message = "Admin user already exists" });
        }

        var adminUser = new User
        {
            Id = Guid.NewGuid(),
            UserName = adminEmail,
            Email = adminEmail,
            FullName = "Sarah Admin",
            Role = "Admin",
            CreatedAt = DateTime.UtcNow,
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(adminUser, "Admin123!");
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = $"Failed to create admin user: {errors}" });
        }

        // Assign Admin role
        await _userManager.AddToRoleAsync(adminUser, "Admin");

        return Ok(new 
        { 
            message = "Admin user created successfully",
            email = adminEmail,
            password = "Admin123!",
            note = "Please change the password after first login"
        });
    }

    [HttpPost("change-password")]
    [Authorize] // This endpoint requires authentication
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null || !Guid.TryParse(userId, out var userGuid))
            return Unauthorized(new { message = "Invalid token" });

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return NotFound(new { message = "User not found" });

        var result = await _userManager.ChangePasswordAsync(user, req.CurrentPassword, req.NewPassword);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = errors });
        }

        return Ok(new { message = "Password changed successfully" });
    }

    private async Task<string> GenerateJwtToken(User user)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = jwtSettings["SecretKey"] ?? Environment.GetEnvironmentVariable("JWT_SECRET_KEY") ?? "YourSuperSecretKeyForJWTTokenGenerationThatShouldBeAtLeast32CharactersLong!";
        var issuer = jwtSettings["Issuer"] ?? "FDMA";
        var audience = jwtSettings["Audience"] ?? "FDMA";
        var expirationMinutes = int.Parse(jwtSettings["ExpirationMinutes"] ?? "1440"); // Default 24 hours

        // Get user roles from Identity
        var userRoles = await _userManager.GetRolesAsync(user);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email ?? ""),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim("Role", user.Role), // Keep custom Role claim for backward compatibility
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // Add Identity roles as claims
        foreach (var role in userRoles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expirationMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Email, string Password, string FullName);
public record ConfirmEmailRequest(string Email, string Token);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string NewPassword);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
