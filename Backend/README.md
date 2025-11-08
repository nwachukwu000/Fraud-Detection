# FDMA Fraud Detection (Clean Architecture, ASP.NET Core 9)

Projects:
- `src/Domain` – Entities/Enums only
- `src/Application` – Interfaces, DTOs, simple rule engine
- `src/Infrastructure` – EF Core (PostgreSQL), repositories, services
- `src/WebApi` – ASP.NET Core Web API + Swagger
- `tests/UnitTests` – xUnit tests with EFCore.InMemory

## Prereqs
- .NET 9 SDK
- PostgreSQL 14+

## Setup
```bash
cd src
dotnet new sln -n FDMA
dotnet sln FDMA.sln add Domain/Domain.csproj Application/Application.csproj Infrastructure/Infrastructure.csproj WebApi/WebApi.csproj
cd ../tests/UnitTests
dotnet restore
cd ../../src/WebApi
# Update appsettings.json or set env var: FDMA__CONNSTR
# Create migration and database
dotnet tool install --global dotnet-ef
dotnet ef migrations add Initial --project ../Infrastructure/Infrastructure.csproj --startup-project WebApi.csproj --context FDMA.Infrastructure.Persistence.AppDbContext
dotnet ef database update --project ../Infrastructure/Infrastructure.csproj --startup-project WebApi.csproj --context FDMA.Infrastructure.Persistence.AppDbContext
dotnet run
```
Navigate to Swagger at `https://localhost:5001/swagger` or `http://localhost:5000/swagger` (depending on Kestrel config).

## Notes
- On app start, database is migrated and seeded (rules + sample transactions). Disable seed if not needed in `Program.cs`.
- Replace the connection string in `appsettings.json` or set env var `FDMA__CONNSTR` before running in production.
- Unit tests:
```bash
cd tests/UnitTests
dotnet test
```