using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Infrastructure.Commit;
using CPQ_Import_App.Infrastructure.Data;
using CPQ_Import_App.Infrastructure.Parsers;
using CPQ_Import_App.Infrastructure.Repositories;
using CPQ_Import_App.Infrastructure.Services;
using CPQ_Import_App.API.Middleware;
using CPQ_Import_App.API.Monitoring;
using CPQ_Import_App.API.Security;
using CPQ_Import_App.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using QuestPDF.Infrastructure;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
QuestPDF.Settings.License = LicenseType.Community;
var disableAuth = builder.Configuration.GetValue<bool>("Auth:DisableAuth");

builder.Services.Configure<AppActivityTrackingOptions>(builder.Configuration.GetSection("ActivityTracking"));
builder.Services.AddSingleton<ILiveUserPresenceTracker, LiveUserPresenceTracker>();

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
        options.UseNpgsql(importConnection,
            npgsql => npgsql.MigrationsAssembly("CPQ_Import_App.Infrastructure"));
        return;
    }

    options.UseSqlServer(importConnection,
        sql => sql.MigrationsAssembly("CPQ_Import_App.Infrastructure"));
});

// ── Repositories & Services ───────────────────────────────────────────────
builder.Services.AddScoped<IImportRepository, ImportRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IActivityRepository, ActivityRepository>();
builder.Services.AddScoped<IImportService, ImportService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IActivityService, ActivityService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddHostedService<ActivityRetentionHostedService>();

var enableGeoLookup = builder.Configuration.GetValue<bool>("ActivityTracking:EnableGeoLookup");
if (enableGeoLookup)
{
    builder.Services.AddHttpClient<IGeoLookupService, GeoLookupHttpService>(client =>
    {
        client.BaseAddress = new Uri("http://ip-api.com/");
        client.Timeout = TimeSpan.FromSeconds(2);
    });
}
else
{
    builder.Services.AddSingleton<IGeoLookupService, NoopGeoLookupService>();
}

// ── File Parsers (one per entity type) ────────────────────────────────────────
builder.Services.AddScoped<IFileParser, ArticleParser>();
builder.Services.AddScoped<IFileParser, PriceListParser>();

// ── Commit Strategies (one per entity type) ───────────────────────────────────
builder.Services.AddScoped<ICpqCommitStrategy, ArticleCommitStrategy>();
builder.Services.AddScoped<ICpqCommitStrategy, PriceListCommitStrategy>();
builder.Services.AddScoped<LocalJwtTokenFactory>();
builder.Services.AddScoped<IEvolisDecryptorService, EvolisDecryptorService>();
builder.Services.AddScoped<EvolisWordDocumentBuilder>();
builder.Services.AddScoped<EvolisPdfDocumentBuilder>();

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
                && (c.Value == "cpq-approver" || c.Value == "cpq-internal-tools" || c.Value == "cpq-admin"))));

    options.AddPolicy("InternalToolsOnly", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim(c =>
                (c.Type == "roles" || c.Type == "role" ||
                 c.Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/role")
                && (c.Value == "cpq-internal-tools" || c.Value == "cpq-admin"))));

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

    if (db.Database.IsNpgsql())
    {
        await db.Database.EnsureCreatedAsync();
        await EnsurePostgresImportJobsColumnsAsync(db);
        await EnsurePostgresActivityEventsTableAsync(db);
    }
    else if (db.Database.IsRelational())
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
app.UseMiddleware<ActivityTrackingMiddleware>();
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

static async Task EnsurePostgresActivityEventsTableAsync(AppDbContext db)
{
    var createSql = """
        CREATE TABLE IF NOT EXISTS import."ActivityEvents" (
            "Id" uuid NOT NULL,
            "OccurredAtUtc" timestamp with time zone NOT NULL,
            "Category" integer NOT NULL,
            "Action" character varying(128) NOT NULL,
            "Description" character varying(2000) NULL,
            "UserId" character varying(128) NULL,
            "UserDisplayName" character varying(256) NULL,
            "UserRole" character varying(64) NULL,
            "TargetType" character varying(128) NULL,
            "TargetId" character varying(128) NULL,
            "Route" character varying(1024) NULL,
            "HttpMethod" character varying(16) NULL,
            "StatusCode" integer NULL,
            "IpAddress" character varying(64) NULL,
            "UserAgent" character varying(1024) NULL,
            "Country" character varying(128) NULL,
            "City" character varying(128) NULL,
            "MetadataJson" text NULL,
            CONSTRAINT "PK_ActivityEvents" PRIMARY KEY ("Id")
        );
        """;

    var indexSql = """
        CREATE INDEX IF NOT EXISTS "IX_ActivityEvents_OccurredAtUtc"
            ON import."ActivityEvents" ("OccurredAtUtc");

        CREATE INDEX IF NOT EXISTS "IX_ActivityEvents_Category"
            ON import."ActivityEvents" ("Category");

        CREATE INDEX IF NOT EXISTS "IX_ActivityEvents_Action"
            ON import."ActivityEvents" ("Action");

        CREATE INDEX IF NOT EXISTS "IX_ActivityEvents_UserId"
            ON import."ActivityEvents" ("UserId");

        CREATE INDEX IF NOT EXISTS "IX_ActivityEvents_OccurredAtUtc_Category"
            ON import."ActivityEvents" ("OccurredAtUtc", "Category");
        """;

    await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA IF NOT EXISTS import; " + createSql + " " + indexSql);
}

static async Task EnsurePostgresImportJobsColumnsAsync(AppDbContext db)
{
    const string sql = """
        ALTER TABLE IF EXISTS import."ImportJobs"
        ADD COLUMN IF NOT EXISTS "ApprovedComparisonJson" text NULL;

        ALTER TABLE IF EXISTS import."ImportJobs"
        ADD COLUMN IF NOT EXISTS "ApprovedAt" timestamp with time zone NULL;

        ALTER TABLE IF EXISTS import."ImportJobs"
        ADD COLUMN IF NOT EXISTS "ApprovedByDisplayName" character varying(512) NULL;

        ALTER TABLE IF EXISTS import."ImportJobs"
        ADD COLUMN IF NOT EXISTS "ApprovedByUserId" character varying(256) NULL;
        """;

    await db.Database.ExecuteSqlRawAsync(sql);
}

