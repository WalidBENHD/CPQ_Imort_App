using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEvolisDecryptionHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var postgres = ActiveProvider.Contains("Npgsql", StringComparison.OrdinalIgnoreCase);
            var idType = postgres ? "uuid" : "uniqueidentifier";
            var dateType = postgres ? "timestamp with time zone" : "datetime2";
            var intType = postgres ? "integer" : "int";
            static string TextType(bool postgres, int length) => postgres ? $"character varying({length})" : $"nvarchar({length})";

            migrationBuilder.CreateTable(
                name: "EvolisDecryptionRuns",
                schema: "import",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: idType, nullable: false),
                    FileName = table.Column<string>(type: TextType(postgres, 512), maxLength: 512, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    FileHash = table.Column<string>(type: TextType(postgres, 64), maxLength: 64, nullable: false),
                    UserId = table.Column<string>(type: TextType(postgres, 256), maxLength: 256, nullable: false),
                    UserDisplayName = table.Column<string>(type: TextType(postgres, 512), maxLength: 512, nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: dateType, nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: dateType, nullable: true),
                    Status = table.Column<int>(type: intType, nullable: false),
                    OutputFormat = table.Column<string>(type: TextType(postgres, 32), maxLength: 32, nullable: true),
                    FailureReason = table.Column<string>(type: TextType(postgres, 1000), maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvolisDecryptionRuns", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EvolisDecryptionRuns_StartedAtUtc",
                schema: "import",
                table: "EvolisDecryptionRuns",
                column: "StartedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_EvolisDecryptionRuns_Status_StartedAtUtc",
                schema: "import",
                table: "EvolisDecryptionRuns",
                columns: new[] { "Status", "StartedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_EvolisDecryptionRuns_UserId_StartedAtUtc",
                schema: "import",
                table: "EvolisDecryptionRuns",
                columns: new[] { "UserId", "StartedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EvolisDecryptionRuns",
                schema: "import");
        }
    }
}
