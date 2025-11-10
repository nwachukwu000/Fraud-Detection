using FDMA.Application.Interfaces;
using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using FDMA.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// PostgreSQL
var conn = builder.Configuration.GetConnectionString("DefaultConnection") 
           ?? Environment.GetEnvironmentVariable("FDMA__CONNSTR");
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(conn));

// Identity
builder.Services.AddIdentity<User, IdentityRole<Guid>>(options =>
{
    // Password settings
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 6;
    
    // User settings
    options.User.RequireUniqueEmail = true;
    
    // Lockout settings
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"] ?? Environment.GetEnvironmentVariable("JWT_SECRET_KEY") ?? "YourSuperSecretKeyForJWTTokenGenerationThatShouldBeAtLeast32CharactersLong!";
var issuer = jwtSettings["Issuer"] ?? "FDMA";
var audience = jwtSettings["Audience"] ?? "FDMA";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.SaveToken = true;
    options.RequireHttpsMetadata = false; // Set to true in production
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = issuer,
        ValidAudience = audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization(options =>
{
    // Role-based authorization policies
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    options.AddPolicy("AdminOrAnalyst", policy => policy.RequireRole("Admin", "Analyst"));
});

// DI
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<ITransactionService, TransactionService>();
builder.Services.AddScoped<IAlertService, AlertService>();

// Background Services
builder.Services.AddHostedService<EmailReplyMonitorService>();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:8080", 
                "https://localhost:8080",
                "http://localhost:5173", 
                "https://localhost:5173",
                "http://localhost:3000",
                "https://localhost:3000"
              )
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.WriteIndented = false;
    });

var app = builder.Build();

// Auto-migrate
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    db.Database.Migrate();
    await FDMA.Infrastructure.Persistence.DbSeeder.SeedAsync(db, userManager, roleManager);
}

//if (app.Environment.IsDevelopment())
//{
    // app.UseSwagger();
    // app.UseSwaggerUI();
//}
app.UseSwagger();
app.UseSwaggerUI();

// CORS must be before HTTPS redirection to handle preflight requests
app.UseCors("AllowFrontend");

// Only redirect to HTTPS in production, allow HTTP in development
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Authentication & Authorization
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.Run();