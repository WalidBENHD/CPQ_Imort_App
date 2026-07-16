using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPQ_Import_App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCapabilityBasedAccessControl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSuspended",
                schema: "import",
                table: "TestUsers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "AccessRoles",
                schema: "import",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Icon = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Color = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoleCapabilities",
                schema: "import",
                columns: table => new
                {
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Capability = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleCapabilities", x => new { x.RoleId, x.Capability });
                    table.ForeignKey(
                        name: "FK_RoleCapabilities_AccessRoles_RoleId",
                        column: x => x.RoleId,
                        principalSchema: "import",
                        principalTable: "AccessRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserAccessRoles",
                schema: "import",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserAccessRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_UserAccessRoles_AccessRoles_RoleId",
                        column: x => x.RoleId,
                        principalSchema: "import",
                        principalTable: "AccessRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserAccessRoles_TestUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "import",
                        principalTable: "TestUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccessRoles_Key",
                schema: "import",
                table: "AccessRoles",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserAccessRoles_RoleId",
                schema: "import",
                table: "UserAccessRoles",
                column: "RoleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RoleCapabilities",
                schema: "import");

            migrationBuilder.DropTable(
                name: "UserAccessRoles",
                schema: "import");

            migrationBuilder.DropTable(
                name: "AccessRoles",
                schema: "import");

            migrationBuilder.DropColumn(
                name: "IsSuspended",
                schema: "import",
                table: "TestUsers");
        }
    }
}
