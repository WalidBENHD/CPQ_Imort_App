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
using CPQ_Import_App.Core.Security;
using Microsoft.AspNetCore.Authorization;
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
builder.Services.AddScoped<AccessControlService>();
builder.Services.AddScoped<IAuthorizationHandler, CapabilityAuthorizationHandler>();
builder.Services.AddScoped<IEvolisDecryptorService, EvolisDecryptorService>();
builder.Services.AddScoped<IEvolisHistoryService, EvolisHistoryService>();
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
    options.DefaultPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .AddRequirements(new ActiveAccountRequirement())
        .Build();
    foreach (var capability in Capabilities.All)
        options.AddPolicy(capability, policy => policy.RequireAuthenticatedUser().RequireCapability(capability));

    options.AddPolicy("ApproverOnly", policy => policy.RequireAuthenticatedUser().RequireCapability(Capabilities.ImportsApprove));
    options.AddPolicy("InternalToolsOnly", policy => policy.RequireAuthenticatedUser().RequireCapability(Capabilities.ToolsEvolis));
    options.AddPolicy("AdminOnly", policy => policy.RequireAuthenticatedUser().RequireCapability(Capabilities.UsersManage));
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
        await EnsurePostgresEditableDraftColumnsAsync(db);
        await EnsurePostgresActivityEventsTableAsync(db);
        await EnsurePostgresAccessControlTablesAsync(db);
        await EnsurePostgresEvolisDecryptionRunsAsync(db);
    }
    else if (db.Database.IsRelational())
    {
        await db.Database.MigrateAsync();
    }

    if (disableAuth)
    {
        await LocalAuthBootstrapper.EnsureSeedAdminAsync(db, app.Configuration);
    }

    await AccessControlBootstrapper.EnsureSeedDataAsync(db);
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
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'import' AND table_name = 'ImportJobs' AND column_name = 'WorkflowStage'
            ) THEN
                ALTER TABLE import."ImportJobs" ADD COLUMN "WorkflowStage" integer NOT NULL DEFAULT 0;
                UPDATE import."ImportJobs"
                SET "WorkflowStage" = CASE
                    WHEN "Status" = 2 THEN 1
                    WHEN "Status" = 8 THEN 2
                    WHEN "Status" = 4 THEN 3
                    WHEN "Status" = 5 THEN 4
                    WHEN "Status" = 7 THEN 5
                    ELSE 0 END;
            END IF;
        END $$;

        ALTER TABLE IF EXISTS import."ImportJobs"
        ADD COLUMN IF NOT EXISTS "SubmittedAt" timestamp with time zone NULL;

        ALTER TABLE IF EXISTS import."ImportJobs"
        ADD COLUMN IF NOT EXISTS "SubmittedByDisplayName" character varying(512) NULL;

        ALTER TABLE IF EXISTS import."ImportJobs"
        ADD COLUMN IF NOT EXISTS "SubmittedByUserId" character varying(256) NULL;

        ALTER TABLE IF EXISTS import."ImportJobs"
        ADD COLUMN IF NOT EXISTS "SubmittedComparisonJson" text NULL;

        ALTER TABLE IF EXISTS import."ImportJobs"
        ADD COLUMN IF NOT EXISTS "WithdrawnAt" timestamp with time zone NULL;

        UPDATE import."ImportJobs"
        SET "SubmittedAt" = COALESCE("ProcessedAt", "CreatedAt"),
            "SubmittedByUserId" = "CreatedBy",
            "SubmittedByDisplayName" = "CreatedByDisplayName"
        WHERE "WorkflowStage" IN (1, 2, 3, 4) AND "SubmittedAt" IS NULL;

        CREATE INDEX IF NOT EXISTS "IX_ImportJobs_WorkflowStage_CreatedAt"
            ON import."ImportJobs" ("WorkflowStage", "CreatedAt");

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

static async Task EnsurePostgresAccessControlTablesAsync(AppDbContext db)
{
    const string sql = """
        ALTER TABLE IF EXISTS import."TestUsers"
        ADD COLUMN IF NOT EXISTS "IsSuspended" boolean NOT NULL DEFAULT false;

        CREATE TABLE IF NOT EXISTS import."AccessRoles" (
            "Id" uuid NOT NULL,
            "Key" character varying(80) NOT NULL,
            "Name" character varying(120) NOT NULL,
            "Description" character varying(1000) NOT NULL,
            "Icon" character varying(80) NOT NULL,
            "Color" character varying(32) NOT NULL,
            "IsSystem" boolean NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_AccessRoles" PRIMARY KEY ("Id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_AccessRoles_Key" ON import."AccessRoles" ("Key");

        CREATE TABLE IF NOT EXISTS import."RoleCapabilities" (
            "RoleId" uuid NOT NULL,
            "Capability" character varying(120) NOT NULL,
            CONSTRAINT "PK_RoleCapabilities" PRIMARY KEY ("RoleId", "Capability"),
            CONSTRAINT "FK_RoleCapabilities_AccessRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES import."AccessRoles" ("Id") ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS import."UserAccessRoles" (
            "UserId" uuid NOT NULL,
            "RoleId" uuid NOT NULL,
            CONSTRAINT "PK_UserAccessRoles" PRIMARY KEY ("UserId", "RoleId"),
            CONSTRAINT "FK_UserAccessRoles_TestUsers_UserId" FOREIGN KEY ("UserId") REFERENCES import."TestUsers" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_UserAccessRoles_AccessRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES import."AccessRoles" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_UserAccessRoles_RoleId" ON import."UserAccessRoles" ("RoleId");
        """;

    await db.Database.ExecuteSqlRawAsync(sql);
}

static async Task EnsurePostgresEditableDraftColumnsAsync(AppDbContext db)
{
    const string sql = """
        ALTER TABLE IF EXISTS import."StagingRows"
        ADD COLUMN IF NOT EXISTS "IsUserAdded" boolean NOT NULL DEFAULT false;

        ALTER TABLE IF EXISTS import."StagingRows"
        ADD COLUMN IF NOT EXISTS "IsUserModified" boolean NOT NULL DEFAULT false;

        ALTER TABLE IF EXISTS import."StagingRows"
        ADD COLUMN IF NOT EXISTS "IsDeleted" boolean NOT NULL DEFAULT false;

        ALTER TABLE IF EXISTS import."StagingRows"
        ADD COLUMN IF NOT EXISTS "DeletedAt" timestamp with time zone NULL;

        ALTER TABLE IF EXISTS import."StagingRows"
        ADD COLUMN IF NOT EXISTS "DeletedByUserId" character varying(256) NULL;

        ALTER TABLE IF EXISTS import."StagingRows"
        ADD COLUMN IF NOT EXISTS "DeletedByDisplayName" character varying(512) NULL;

        CREATE INDEX IF NOT EXISTS "IX_StagingRows_ImportJobId_IsDeleted_RowNumber"
            ON import."StagingRows" ("ImportJobId", "IsDeleted", "RowNumber");
        """;

    await db.Database.ExecuteSqlRawAsync(sql);
}

static async Task EnsurePostgresEvolisDecryptionRunsAsync(AppDbContext db)
{
    const string sql = """
        CREATE TABLE IF NOT EXISTS import."EvolisDecryptionRuns" (
            "Id" uuid NOT NULL,
            "FileName" character varying(512) NOT NULL,
            "FileSize" bigint NOT NULL,
            "FileHash" character varying(64) NOT NULL,
            "UserId" character varying(256) NOT NULL,
            "UserDisplayName" character varying(512) NOT NULL,
            "StartedAtUtc" timestamp with time zone NOT NULL,
            "CompletedAtUtc" timestamp with time zone NULL,
            "Status" integer NOT NULL,
            "OutputFormat" character varying(32) NULL,
            "FailureReason" character varying(1000) NULL,
            CONSTRAINT "PK_EvolisDecryptionRuns" PRIMARY KEY ("Id")
        );
        CREATE INDEX IF NOT EXISTS "IX_EvolisDecryptionRuns_StartedAtUtc" ON import."EvolisDecryptionRuns" ("StartedAtUtc");
        CREATE INDEX IF NOT EXISTS "IX_EvolisDecryptionRuns_UserId_StartedAtUtc" ON import."EvolisDecryptionRuns" ("UserId", "StartedAtUtc");
        CREATE INDEX IF NOT EXISTS "IX_EvolisDecryptionRuns_Status_StartedAtUtc" ON import."EvolisDecryptionRuns" ("Status", "StartedAtUtc");
        """;

    await db.Database.ExecuteSqlRawAsync(sql);
}

