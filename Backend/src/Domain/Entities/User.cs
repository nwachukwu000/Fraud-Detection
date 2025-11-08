using Microsoft.AspNetCore.Identity;

namespace FDMA.Domain.Entities;

public class User : IdentityUser<Guid>
{
    public string FullName { get; set; } = default!;
    public string Role { get; set; } = default!; // Admin, Analyst, Investigator, Viewer
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
