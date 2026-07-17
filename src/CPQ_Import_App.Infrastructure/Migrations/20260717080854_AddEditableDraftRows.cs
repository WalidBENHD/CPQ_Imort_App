using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEditableDraftRows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var postgres = ActiveProvider.Contains("Npgsql", StringComparison.OrdinalIgnoreCase);
            var dateType = postgres ? "timestamp with time zone" : "datetime2";
            var displayNameType = postgres ? "character varying(512)" : "nvarchar(512)";
            var userIdType = postgres ? "character varying(256)" : "nvarchar(256)";
            var boolType = postgres ? "boolean" : "bit";

            migrationBuilder.DropIndex(
                name: "IX_StagingRows_ImportJobId",
                schema: "import",
                table: "StagingRows");

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                schema: "import",
                table: "StagingRows",
                type: dateType,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedByDisplayName",
                schema: "import",
                table: "StagingRows",
                type: displayNameType,
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedByUserId",
                schema: "import",
                table: "StagingRows",
                type: userIdType,
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                schema: "import",
                table: "StagingRows",
                type: boolType,
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsUserAdded",
                schema: "import",
                table: "StagingRows",
                type: boolType,
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsUserModified",
                schema: "import",
                table: "StagingRows",
                type: boolType,
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_StagingRows_ImportJobId_IsDeleted_RowNumber",
                schema: "import",
                table: "StagingRows",
                columns: new[] { "ImportJobId", "IsDeleted", "RowNumber" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StagingRows_ImportJobId_IsDeleted_RowNumber",
                schema: "import",
                table: "StagingRows");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                schema: "import",
                table: "StagingRows");

            migrationBuilder.DropColumn(
                name: "DeletedByDisplayName",
                schema: "import",
                table: "StagingRows");

            migrationBuilder.DropColumn(
                name: "DeletedByUserId",
                schema: "import",
                table: "StagingRows");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                schema: "import",
                table: "StagingRows");

            migrationBuilder.DropColumn(
                name: "IsUserAdded",
                schema: "import",
                table: "StagingRows");

            migrationBuilder.DropColumn(
                name: "IsUserModified",
                schema: "import",
                table: "StagingRows");

            migrationBuilder.CreateIndex(
                name: "IX_StagingRows_ImportJobId",
                schema: "import",
                table: "StagingRows",
                column: "ImportJobId");
        }
    }
}
