using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddApprovedComparisonJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApprovedComparisonJson",
                schema: "import",
                table: "ImportJobs",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovedComparisonJson",
                schema: "import",
                table: "ImportJobs");
        }
    }
}
