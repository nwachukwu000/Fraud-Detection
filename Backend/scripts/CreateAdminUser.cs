using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

// Simple script to create admin user
// Run with: dotnet run --project Backend/src/WebApi

var builder = WebApplication.CreateBuilder(args);

// PostgreSQL
var conn = builder.Configuration.GetConnectionString("DefaultConnection") 
           ?? Environment.GetEnvironmentVariable("FDMA__CONNSTR");
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(conn));

// Identity
builder.Services.AddIdentity<User, IdentityRole<Guid>>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 6;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    
    // Create Admin role if it doesn't exist
    if (!await roleManager.RoleExistsAsync("Admin"))
    {
        await roleManager.CreateAsync(new IdentityRole<Guid> { Name = "Admin" });
        Console.WriteLine("Admin role created.");
    }
    
    // Create admin user
    var adminEmail = "admin@fraudguard.com";
    var adminUser = await userManager.FindByEmailAsync(adminEmail);
    
    if (adminUser == null)
    {
        adminUser = new User
        {
            Id = Guid.NewGuid(),
            UserName = adminEmail,
            Email = adminEmail,
            FullName = "Sarah Admin",
            Role = "Admin",
            CreatedAt = DateTime.UtcNow,
            EmailConfirmed = true
        };

        var result = await userManager.CreateAsync(adminUser, "Admin123!");
        if (result.Succeeded)
        {
            await userManager.AddToRoleAsync(adminUser, "Admin");
            Console.WriteLine("Admin user created successfully!");
            Console.WriteLine($"Email: {adminEmail}");
            Console.WriteLine($"Password: Admin123!");
        }
        else
        {
            Console.WriteLine("Failed to create admin user:");
            foreach (var error in result.Errors)
            {
                Console.WriteLine($"  - {error.Description}");
            }
        }
    }
    else
    {
        Console.WriteLine("Admin user already exists.");
        // Ensure admin has Admin role
        var userRoles = await userManager.GetRolesAsync(adminUser);
        if (!userRoles.Contains("Admin"))
        {
            await userManager.AddToRoleAsync(adminUser, "Admin");
            Console.WriteLine("Admin role assigned to existing user.");
        }
        Console.WriteLine($"Email: {adminEmail}");
        Console.WriteLine("Password: (existing password)");
    }
}

Console.WriteLine("\nPress any key to exit...");
Console.ReadKey();

