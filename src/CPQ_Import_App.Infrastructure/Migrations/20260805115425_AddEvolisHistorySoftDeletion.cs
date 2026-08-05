using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEvolisHistorySoftDeletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var postgres = ActiveProvider.Contains("Npgsql", StringComparison.OrdinalIgnoreCase);
            var timestampType = postgres ? "timestamp with time zone" : "datetime2";
            var userIdType = postgres ? "character varying(256)" : "nvarchar(256)";
            var displayNameType = postgres ? "character varying(512)" : "nvarchar(512)";
            var boolType = postgres ? "boolean" : "bit";

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAtUtc",
                schema: "import",
                table: "EvolisDecryptionRuns",
                type: timestampType,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedByDisplayName",
                schema: "import",
                table: "EvolisDecryptionRuns",
                type: displayNameType,
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedByUserId",
                schema: "import",
                table: "EvolisDecryptionRuns",
                type: userIdType,
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                schema: "import",
                table: "EvolisDecryptionRuns",
                type: boolType,
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_EvolisDecryptionRuns_IsDeleted_StartedAtUtc",
                schema: "import",
                table: "EvolisDecryptionRuns",
                columns: new[] { "IsDeleted", "StartedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EvolisDecryptionRuns_IsDeleted_StartedAtUtc",
                schema: "import",
                table: "EvolisDecryptionRuns");

            migrationBuilder.DropColumn(
                name: "DeletedAtUtc",
                schema: "import",
                table: "EvolisDecryptionRuns");

            migrationBuilder.DropColumn(
                name: "DeletedByDisplayName",
                schema: "import",
                table: "EvolisDecryptionRuns");

            migrationBuilder.DropColumn(
                name: "DeletedByUserId",
                schema: "import",
                table: "EvolisDecryptionRuns");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                schema: "import",
                table: "EvolisDecryptionRuns");
        }
    }
}
