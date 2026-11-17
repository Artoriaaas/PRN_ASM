using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Game.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGameRulesAdminSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "score_multiplier",
                table: "levels",
                type: "double precision",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<int>(
                name: "time_limit_seconds",
                table: "levels",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "updated_at",
                table: "levels",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "version",
                table: "levels",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "game_audit_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_firebase_uid = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    target_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    target_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    before_json = table.Column<string>(type: "jsonb", nullable: false),
                    after_json = table.Column<string>(type: "jsonb", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_game_audit_logs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "game_modes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_game_modes", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "task_definitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    condition_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    target = table.Column<int>(type: "integer", nullable: false),
                    progress_source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_task_definitions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_game_audit_logs_created_at",
                table: "game_audit_logs",
                column: "created_at",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "ix_game_modes_code",
                table: "game_modes",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_game_modes_sort_order",
                table: "game_modes",
                column: "sort_order");

            migrationBuilder.CreateIndex(
                name: "ix_task_definitions_code",
                table: "task_definitions",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_task_definitions_sort_order",
                table: "task_definitions",
                column: "sort_order");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "game_audit_logs");

            migrationBuilder.DropTable(
                name: "game_modes");

            migrationBuilder.DropTable(
                name: "task_definitions");

            migrationBuilder.DropColumn(
                name: "score_multiplier",
                table: "levels");

            migrationBuilder.DropColumn(
                name: "time_limit_seconds",
                table: "levels");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "levels");

            migrationBuilder.DropColumn(
                name: "version",
                table: "levels");
        }
    }
}
