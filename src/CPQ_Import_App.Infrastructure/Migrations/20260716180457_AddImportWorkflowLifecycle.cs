using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddImportWorkflowLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var postgres = ActiveProvider.Contains("Npgsql", StringComparison.OrdinalIgnoreCase);
            var dateType = postgres ? "timestamp with time zone" : "datetime2";
            var userIdType = postgres ? "character varying(256)" : "nvarchar(256)";
            var displayNameType = postgres ? "character varying(512)" : "nvarchar(512)";
            var textType = postgres ? "text" : "nvarchar(max)";

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedAt",
                schema: "import",
                table: "ImportJobs",
                type: dateType,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedByDisplayName",
                schema: "import",
                table: "ImportJobs",
                type: displayNameType,
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedByUserId",
                schema: "import",
                table: "ImportJobs",
                type: userIdType,
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedComparisonJson",
                schema: "import",
                table: "ImportJobs",
                type: textType,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WithdrawnAt",
                schema: "import",
                table: "ImportJobs",
                type: dateType,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WorkflowStage",
                schema: "import",
                table: "ImportJobs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(postgres
                ? """
                    UPDATE import."ImportJobs"
                    SET "WorkflowStage" = CASE
                        WHEN "Status" = 2 THEN 1
                        WHEN "Status" = 8 THEN 2
                        WHEN "Status" = 4 THEN 3
                        WHEN "Status" = 5 THEN 4
                        WHEN "Status" = 7 THEN 5
                        ELSE 0 END,
                        "SubmittedAt" = CASE WHEN "Status" IN (2, 4, 5, 8) THEN COALESCE("ProcessedAt", "CreatedAt") ELSE NULL END,
                        "SubmittedByUserId" = CASE WHEN "Status" IN (2, 4, 5, 8) THEN "CreatedBy" ELSE NULL END,
                        "SubmittedByDisplayName" = CASE WHEN "Status" IN (2, 4, 5, 8) THEN "CreatedByDisplayName" ELSE NULL END;
                    """
                : """
                    UPDATE [import].[ImportJobs]
                    SET [WorkflowStage] = CASE
                        WHEN [Status] = 2 THEN 1
                        WHEN [Status] = 8 THEN 2
                        WHEN [Status] = 4 THEN 3
                        WHEN [Status] = 5 THEN 4
                        WHEN [Status] = 7 THEN 5
                        ELSE 0 END,
                        [SubmittedAt] = CASE WHEN [Status] IN (2, 4, 5, 8) THEN COALESCE([ProcessedAt], [CreatedAt]) ELSE NULL END,
                        [SubmittedByUserId] = CASE WHEN [Status] IN (2, 4, 5, 8) THEN [CreatedBy] ELSE NULL END,
                        [SubmittedByDisplayName] = CASE WHEN [Status] IN (2, 4, 5, 8) THEN [CreatedByDisplayName] ELSE NULL END;
                    """);

            migrationBuilder.CreateIndex(
                name: "IX_ImportJobs_WorkflowStage_CreatedAt",
                schema: "import",
                table: "ImportJobs",
                columns: new[] { "WorkflowStage", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_UploadedFiles_ImportJobs_JobId",
                schema: "import",
                table: "UploadedFiles",
                column: "JobId",
                principalSchema: "import",
                principalTable: "ImportJobs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UploadedFiles_ImportJobs_JobId",
                schema: "import",
                table: "UploadedFiles");

            migrationBuilder.DropIndex(
                name: "IX_ImportJobs_WorkflowStage_CreatedAt",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "SubmittedAt",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "SubmittedByDisplayName",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "SubmittedByUserId",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "SubmittedComparisonJson",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "WithdrawnAt",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "WorkflowStage",
                schema: "import",
                table: "ImportJobs");
        }
    }
}
