using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace User.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAdminSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ban_reason",
                schema: "user",
                table: "users",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "banned_until",
                schema: "user",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "last_login_at",
                schema: "user",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "audit_logs",
                schema: "user",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    target_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    target_id = table.Column<Guid>(type: "uuid", nullable: false),
                    before = table.Column<string>(type: "jsonb", nullable: false),
                    after = table.Column<string>(type: "jsonb", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "elo_history",
                schema: "user",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    delta = table.Column<int>(type: "integer", nullable: false),
                    new_elo = table.Column<int>(type: "integer", nullable: false),
                    source_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reason = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_elo_history", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "outbox_messages",
                schema: "user",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    type = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    topic = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    payload = table.Column<byte[]>(type: "bytea", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    processed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    error = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outbox_messages", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_actor_id_created_at",
                schema: "user",
                table: "audit_logs",
                columns: new[] { "actor_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_created_at",
                schema: "user",
                table: "audit_logs",
                column: "created_at",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_target_id_created_at",
                schema: "user",
                table: "audit_logs",
                columns: new[] { "target_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_elo_history_user_id_created_at",
                schema: "user",
                table: "elo_history",
                columns: new[] { "user_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_elo_history_user_id_source_type_source_id",
                schema: "user",
                table: "elo_history",
                columns: new[] { "user_id", "source_type", "source_id" },
                unique: true,
                filter: "source_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_outbox_messages_created_at",
                schema: "user",
                table: "outbox_messages",
                column: "created_at",
                filter: "processed_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_logs",
                schema: "user");

            migrationBuilder.DropTable(
                name: "elo_history",
                schema: "user");

            migrationBuilder.DropTable(
                name: "outbox_messages",
                schema: "user");

            migrationBuilder.DropColumn(
                name: "ban_reason",
                schema: "user",
                table: "users");

            migrationBuilder.DropColumn(
                name: "banned_until",
                schema: "user",
                table: "users");

            migrationBuilder.DropColumn(
                name: "last_login_at",
                schema: "user",
                table: "users");
        }
    }
}
