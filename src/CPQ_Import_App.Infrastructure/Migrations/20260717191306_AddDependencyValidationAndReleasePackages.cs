using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDependencyValidationAndReleasePackages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var isPostgres = ActiveProvider.Contains("Npgsql", StringComparison.OrdinalIgnoreCase);
            var guidType = isPostgres ? "uuid" : "uniqueidentifier";
            var intType = isPostgres ? "integer" : "int";
            var dateType = isPostgres ? "timestamp with time zone" : "datetime2";
            var stringType = isPostgres ? "character varying" : "nvarchar";
            var textType = isPostgres ? "text" : "nvarchar(max)";

            migrationBuilder.AddColumn<Guid>(
                name: "ReleasePackageId",
                schema: "import",
                table: "ImportJobs",
                type: guidType,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ValidationAnchorJobId",
                schema: "import",
                table: "ImportJobs",
                type: guidType,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ValidationAnchorKind",
                schema: "import",
                table: "ImportJobs",
                type: intType,
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "ValidationAnchorPinnedAt",
                schema: "import",
                table: "ImportJobs",
                type: dateType,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ReleasePackages",
                schema: "import",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: guidType, nullable: false),
                    Name = table.Column<string>(type: $"{stringType}(180)", maxLength: 180, nullable: false),
                    Status = table.Column<int>(type: intType, nullable: false),
                    CreatedBy = table.Column<string>(type: $"{stringType}(256)", maxLength: 256, nullable: false),
                    CreatedByDisplayName = table.Column<string>(type: $"{stringType}(512)", maxLength: 512, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: dateType, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: dateType, nullable: true),
                    SubmittedByDisplayName = table.Column<string>(type: $"{stringType}(512)", maxLength: 512, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: dateType, nullable: true),
                    ApprovedByUserId = table.Column<string>(type: $"{stringType}(256)", maxLength: 256, nullable: true),
                    ApprovedByDisplayName = table.Column<string>(type: $"{stringType}(512)", maxLength: 512, nullable: true),
                    PublishedAt = table.Column<DateTime>(type: dateType, nullable: true),
                    PublishedByDisplayName = table.Column<string>(type: $"{stringType}(512)", maxLength: 512, nullable: true),
                    FailureReason = table.Column<string>(type: $"{stringType}(2000)", maxLength: 2000, nullable: true),
                    ApprovalEvidenceJson = table.Column<string>(type: textType, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReleasePackages", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImportJobs_ReleasePackageId",
                schema: "import",
                table: "ImportJobs",
                column: "ReleasePackageId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportJobs_ValidationAnchorJobId",
                schema: "import",
                table: "ImportJobs",
                column: "ValidationAnchorJobId");

            migrationBuilder.CreateIndex(
                name: "IX_ReleasePackages_CreatedBy",
                schema: "import",
                table: "ReleasePackages",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_ReleasePackages_Status_CreatedAt",
                schema: "import",
                table: "ReleasePackages",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_ImportJobs_ReleasePackages_ReleasePackageId",
                schema: "import",
                table: "ImportJobs",
                column: "ReleasePackageId",
                principalSchema: "import",
                principalTable: "ReleasePackages",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.Sql(isPostgres
                ? """
                    UPDATE import."ImportJobs" dependent
                    SET "ValidationAnchorJobId" = active."Id",
                        "ValidationAnchorKind" = 1,
                        "ValidationAnchorPinnedAt" = NOW()
                    FROM (
                        SELECT "Id" FROM import."ImportJobs"
                        WHERE "EntityType" = 1 AND "Status" = 4
                        ORDER BY "CommittedAt" DESC NULLS LAST, "CreatedAt" DESC
                        LIMIT 1
                    ) active
                    WHERE dependent."EntityType" IN (2, 3)
                      AND dependent."ValidationAnchorJobId" IS NULL;
                    """
                : """
                    UPDATE dependent
                    SET dependent.[ValidationAnchorJobId] = active.[Id],
                        dependent.[ValidationAnchorKind] = 1,
                        dependent.[ValidationAnchorPinnedAt] = SYSUTCDATETIME()
                    FROM [import].[ImportJobs] dependent
                    CROSS APPLY (
                        SELECT TOP (1) [Id] FROM [import].[ImportJobs]
                        WHERE [EntityType] = 1 AND [Status] = 4
                        ORDER BY [CommittedAt] DESC, [CreatedAt] DESC
                    ) active
                    WHERE dependent.[EntityType] IN (2, 3)
                      AND dependent.[ValidationAnchorJobId] IS NULL;
                    """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ImportJobs_ReleasePackages_ReleasePackageId",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropTable(
                name: "ReleasePackages",
                schema: "import");

            migrationBuilder.DropIndex(
                name: "IX_ImportJobs_ReleasePackageId",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropIndex(
                name: "IX_ImportJobs_ValidationAnchorJobId",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "ReleasePackageId",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "ValidationAnchorJobId",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "ValidationAnchorKind",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "ValidationAnchorPinnedAt",
                schema: "import",
                table: "ImportJobs");
        }
    }
}
