using FDMA.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FDMA.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, UserManager<User> userManager, RoleManager<IdentityRole<Guid>> roleManager)
    {
        // Create roles if they don't exist
        var roles = new[] { "Admin", "Analyst", "Viewer" };
        foreach (var roleName in roles)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new IdentityRole<Guid> { Name = roleName });
            }
        }
        if (!await db.Rules.AnyAsync())
        {
            db.Rules.AddRange(
                new Rule { Id = Guid.NewGuid(), Name = "High Amount Transaction", Field = "Amount", Condition = "GreaterThan", Value = "200000", IsEnabled = true },
                new Rule { Id = Guid.NewGuid(), Name = "New Device + Large Transfer", Field = "Device", Condition = "Equals", Value = "NewDevice", IsEnabled = false }
            );
        }
        if (!await db.Transactions.AnyAsync())
        {
            for (int i=0;i<20;i++)
            {
                db.Transactions.Add(new Transaction
                {
                    Id = Guid.NewGuid(),
                    SenderAccountNumber = $"000{i:0000000000}",
                    ReceiverAccountNumber = $"111{i:0000000000}",
                    TransactionType = "Transfer",
                    CreatedAt = DateTime.UtcNow.AddMinutes(-i*5),
                    Amount = 100000 + i*50000,
                    Device = i%3==0 ? "NewDevice" : "iOS",
                    Location = i%2==0 ? "NG-LAGOS" : "NG-ABUJA",
                    IpAddress = $"192.168.1.{100 + i}",
                    Status = "Completed",
                    RiskScore = 0
                });
            }
        }

        // Seed default admin user if it doesn't exist
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
                // Assign Admin role to the user
                await userManager.AddToRoleAsync(adminUser, "Admin");
            }
        }
        else
        {
            // Ensure admin user has Admin role even if they exist
            var userRoles = await userManager.GetRolesAsync(adminUser);
            if (!userRoles.Contains("Admin"))
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
            }
            // Ensure Role property is set
            if (adminUser.Role != "Admin")
            {
                adminUser.Role = "Admin";
                await userManager.UpdateAsync(adminUser);
            }
        }

        await db.SaveChangesAsync();
    }
}