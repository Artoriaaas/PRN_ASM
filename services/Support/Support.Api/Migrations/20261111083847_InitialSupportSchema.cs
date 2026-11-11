using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Support.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialSupportSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "support");

            migrationBuilder.CreateTable(
                name: "system_notices",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    is_pinned = table.Column<bool>(type: "boolean", nullable: false),
                    published_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_system_notices", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tutorials",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    summary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    difficulty = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_published = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tutorials", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_system_notices_is_pinned",
                schema: "support",
                table: "system_notices",
                column: "is_pinned");

            migrationBuilder.CreateIndex(
                name: "ix_system_notices_published_at",
                schema: "support",
                table: "system_notices",
                column: "published_at");

            migrationBuilder.CreateIndex(
                name: "ix_tutorials_category",
                schema: "support",
                table: "tutorials",
                column: "category");

            migrationBuilder.CreateIndex(
                name: "ix_tutorials_difficulty",
                schema: "support",
                table: "tutorials",
                column: "difficulty");

            migrationBuilder.CreateIndex(
                name: "ix_tutorials_sort_order",
                schema: "support",
                table: "tutorials",
                column: "sort_order");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "system_notices",
                schema: "support");

            migrationBuilder.DropTable(
                name: "tutorials",
                schema: "support");
        }
    }
}
