using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddControlledPublication : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                schema: "import",
                table: "ImportJobs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedByDisplayName",
                schema: "import",
                table: "ImportJobs",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedByUserId",
                schema: "import",
                table: "ImportJobs",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "ApprovedByDisplayName",
                schema: "import",
                table: "ImportJobs");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                schema: "import",
                table: "ImportJobs");
        }
    }
}
