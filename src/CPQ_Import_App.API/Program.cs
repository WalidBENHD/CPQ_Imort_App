using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Infrastructure.Commit;
using CPQ_Import_App.Infrastructure.Data;
using CPQ_Import_App.Infrastructure.Parsers;
using CPQ_Import_App.Infrastructure.Repositories;
using CPQ_Import_App.Infrastructure.Services;
using CPQ_Import_App.API.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
var disableAuth = builder.Configuration.GetValue<bool>("Auth:DisableAuth");

var renderPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(renderPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{renderPort}");
}

// ── Database ──────────────────────────────────────────────────────────────────
var databaseProvider = builder.Configuration["Database:Provider"] ?? "SqlServer";
var importConnection = ResolveConnectionString(builder.Configuration.GetConnectionString("ImportDatabase"));

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (string.Equals(databaseProvider, "Postgres", StringComparison.OrdinalIgnoreCase))
    {
        options.UseNpgsql(importConnection);
        return;
    }

    options.UseSqlServer(importConnection,
        sql => sql.MigrationsAssembly("CPQ_Import_App.Infrastructure"));
});

// ── Repositories & Services ───────────────────────────────────────────────
builder.Services.AddScoped<IImportRepository, ImportRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IImportService, ImportService>();
builder.Services.AddScoped<INotificationService, NotificationService>();

// ── File Parsers (one per entity type) ────────────────────────────────────────
builder.Services.AddScoped<IFileParser, ArticleParser>();
builder.Services.AddScoped<IFileParser, PriceListParser>();
builder.Services.AddScoped<IFileParser, DescriptionParser>();
builder.Services.AddScoped<IFileParser, CurrencyRateParser>();

// ── Commit Strategies (one per entity type) ───────────────────────────────────
builder.Services.AddScoped<ICpqCommitStrategy, ArticleCommitStrategy>();
builder.Services.AddScoped<ICpqCommitStrategy, PriceListCommitStrategy>();
builder.Services.AddScoped<ICpqCommitStrategy, DescriptionCommitStrategy>();
builder.Services.AddScoped<ICpqCommitStrategy, CurrencyRateCommitStrategy>();
builder.Services.AddScoped<LocalJwtTokenFactory>();

// ── Authentication (JWT Bearer / OIDC) ────────────────────────────────────────
// Configure your OIDC provider in appsettings.json under "Auth".
// In local development, Auth:DisableAuth=true enables a fake authenticated user.
if (disableAuth)
{
    var issuer = builder.Configuration["Auth:Local:Issuer"] ?? "CPQImportLocal";
    var audience = builder.Configuration["Auth:Local:Audience"] ?? "CPQImportLocalClient";
    var signingKey = builder.Configuration["Auth:Local:SigningKey"] ?? "ChangeThisLocalSigningKey_AtLeast32Characters!";

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.RequireHttpsMetadata = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = issuer,
                ValidAudience = audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                NameClaimType = "name",
                RoleClaimType = "roles",
                ClockSkew = TimeSpan.FromMinutes(1)
            };
        });
}
else
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = builder.Configuration["Auth:Authority"];
            options.Audience = builder.Configuration["Auth:Audience"];
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                NameClaimType = "name",
                RoleClaimType = "roles",
                ClockSkew = TimeSpan.FromMinutes(5)
            };
        });
}

// ── Authorization Policies ────────────────────────────────────────────────────
builder.Services.AddAuthorization(options =>
{
    // Users with claim "roles" containing "cpq-approver" can commit/reject imports.
    // Adjust the claim type to match your OIDC provider's token structure.
    options.AddPolicy("ApproverOnly", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim(c =>
                (c.Type == "roles" || c.Type == "role" ||
                 c.Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/role")
                && (c.Value == "cpq-approver" || c.Value == "cpq-admin"))));

    options.AddPolicy("AdminOnly", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim(c =>
                (c.Type == "roles" || c.Type == "role" ||
                 c.Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/role")
                && c.Value == "cpq-admin")));
});

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(o => o.AddPolicy("Angular", p =>
    p.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? ["http://localhost:4200"])
     .AllowAnyMethod()
     .AllowAnyHeader()
     .AllowCredentials()));

// ── Controllers & Swagger ─────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "CPQ Import API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Paste your JWT access token."
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
        }] = []
    });
});

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// ── Middleware pipeline ───────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // SQL Server uses migrations; Postgres test deployment can bootstrap with EnsureCreated.
    if (db.Database.IsNpgsql())
    {
        await db.Database.EnsureCreatedAsync();
    }
    else if (app.Environment.IsDevelopment())
    {
        await db.Database.MigrateAsync();
    }

    if (disableAuth)
    {
        await LocalAuthBootstrapper.EnsureSeedAdminAsync(db, app.Configuration);
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors("Angular");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();

static string ResolveConnectionString(string? raw)
{
    if (string.IsNullOrWhiteSpace(raw))
    {
        throw new InvalidOperationException("Connection string 'ImportDatabase' is not configured.");
    }

    if (raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
        || raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        var uri = new Uri(raw);
        var userInfo = uri.UserInfo.Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
        var user = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : string.Empty;
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
        var database = uri.AbsolutePath.Trim('/');
        var port = uri.IsDefaultPort ? 5432 : uri.Port;

        return $"Host={uri.Host};Port={port};Database={database};Username={user};Password={password};SSL Mode=Require;Trust Server Certificate=true";
    }

    return raw;
}

