using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RetainEvolisSourceAndResult : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var postgres = ActiveProvider.Contains("Npgsql", System.StringComparison.OrdinalIgnoreCase);
            var longTextType = postgres ? "text" : "nvarchar(max)";
            var boolType = postgres ? "boolean" : "bit";
            var binaryType = postgres ? "bytea" : "varbinary(max)";
            var contentType = postgres ? "character varying(128)" : "nvarchar(128)";

            migrationBuilder.AddColumn<string>(
                name: "DecryptedContent",
                schema: "import",
                table: "EvolisDecryptionRuns",
                type: longTextType,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasResult",
                schema: "import",
                table: "EvolisDecryptionRuns",
                type: boolType,
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "HasSourceFile",
                schema: "import",
                table: "EvolisDecryptionRuns",
                type: boolType,
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SourceContentType",
                schema: "import",
                table: "EvolisDecryptionRuns",
                type: contentType,
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "SourceFileContent",
                schema: "import",
                table: "EvolisDecryptionRuns",
                type: binaryType,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DecryptedContent",
                schema: "import",
                table: "EvolisDecryptionRuns");

            migrationBuilder.DropColumn(
                name: "HasResult",
                schema: "import",
                table: "EvolisDecryptionRuns");

            migrationBuilder.DropColumn(
                name: "HasSourceFile",
                schema: "import",
                table: "EvolisDecryptionRuns");

            migrationBuilder.DropColumn(
                name: "SourceContentType",
                schema: "import",
                table: "EvolisDecryptionRuns");

            migrationBuilder.DropColumn(
                name: "SourceFileContent",
                schema: "import",
                table: "EvolisDecryptionRuns");
        }
    }
}
