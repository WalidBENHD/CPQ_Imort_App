using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActivityEvents",
                schema: "import",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Category = table.Column<int>(type: "int", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    UserId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    UserDisplayName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    UserRole = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    TargetType = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    TargetId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    Route = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    HttpMethod = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    StatusCode = table.Column<int>(type: "int", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    Country = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    City = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    MetadataJson = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityEvents_Action",
                schema: "import",
                table: "ActivityEvents",
                column: "Action");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityEvents_Category",
                schema: "import",
                table: "ActivityEvents",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityEvents_OccurredAtUtc",
                schema: "import",
                table: "ActivityEvents",
                column: "OccurredAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityEvents_OccurredAtUtc_Category",
                schema: "import",
                table: "ActivityEvents",
                columns: new[] { "OccurredAtUtc", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityEvents_UserId",
                schema: "import",
                table: "ActivityEvents",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActivityEvents",
                schema: "import");
        }
    }
}
