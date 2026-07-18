using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddReleasePackageRejection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var postgres = ActiveProvider.Contains("Npgsql", StringComparison.OrdinalIgnoreCase);
            var dateType = postgres ? "timestamp with time zone" : "datetime2";
            static string TextType(bool postgres, int length) => postgres ? $"character varying({length})" : $"nvarchar({length})";

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedAt",
                schema: "import",
                table: "ReleasePackages",
                type: dateType,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectedByDisplayName",
                schema: "import",
                table: "ReleasePackages",
                type: TextType(postgres, 512),
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectedByUserId",
                schema: "import",
                table: "ReleasePackages",
                type: TextType(postgres, 256),
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                schema: "import",
                table: "ReleasePackages",
                type: TextType(postgres, 2000),
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RejectedAt",
                schema: "import",
                table: "ReleasePackages");

            migrationBuilder.DropColumn(
                name: "RejectedByDisplayName",
                schema: "import",
                table: "ReleasePackages");

            migrationBuilder.DropColumn(
                name: "RejectedByUserId",
                schema: "import",
                table: "ReleasePackages");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                schema: "import",
                table: "ReleasePackages");
        }
    }
}
