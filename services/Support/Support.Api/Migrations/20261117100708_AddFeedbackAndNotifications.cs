using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Support.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedbackAndNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "feedback_tickets",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    assigned_admin_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    related_match_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_feedback_tickets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "inbox_messages",
                schema: "support",
                columns: table => new
                {
                    event_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    handler_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    processed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inbox_messages", x => new { x.event_id, x.handler_name });
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    body = table.Column<string>(type: "text", nullable: false),
                    ref_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    source_event_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    is_read = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notifications", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "outbox_messages",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("pk_outbox_messages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "player_refs",
                schema: "support",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    display_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_refs", x => x.user_id);
                });

            migrationBuilder.CreateTable(
                name: "support_audit_logs",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    target_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    target_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    before = table.Column<string>(type: "jsonb", nullable: false),
                    after = table.Column<string>(type: "jsonb", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_support_audit_logs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "feedback_messages",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sender_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    sender_role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    content = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_feedback_messages", x => x.id);
                    table.ForeignKey(
                        name: "fk_feedback_messages_feedback_tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalSchema: "support",
                        principalTable: "feedback_tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_feedback_messages_ticket_id_created_at",
                schema: "support",
                table: "feedback_messages",
                columns: new[] { "ticket_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_feedback_tickets_status_created_at",
                schema: "support",
                table: "feedback_tickets",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_feedback_tickets_user_id_created_at",
                schema: "support",
                table: "feedback_tickets",
                columns: new[] { "user_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_notifications_user_id_created_at",
                schema: "support",
                table: "notifications",
                columns: new[] { "user_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_notifications_user_id_source_event_id",
                schema: "support",
                table: "notifications",
                columns: new[] { "user_id", "source_event_id" },
                unique: true,
                filter: "source_event_id IS NOT NULL AND source_event_id <> ''");

            migrationBuilder.CreateIndex(
                name: "ix_outbox_messages_created_at",
                schema: "support",
                table: "outbox_messages",
                column: "created_at",
                filter: "processed_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_support_audit_logs_created_at",
                schema: "support",
                table: "support_audit_logs",
                column: "created_at",
                descending: new bool[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "feedback_messages",
                schema: "support");

            migrationBuilder.DropTable(
                name: "inbox_messages",
                schema: "support");

            migrationBuilder.DropTable(
                name: "notifications",
                schema: "support");

            migrationBuilder.DropTable(
                name: "outbox_messages",
                schema: "support");

            migrationBuilder.DropTable(
                name: "player_refs",
                schema: "support");

            migrationBuilder.DropTable(
                name: "support_audit_logs",
                schema: "support");

            migrationBuilder.DropTable(
                name: "feedback_tickets",
                schema: "support");
        }
    }
}
