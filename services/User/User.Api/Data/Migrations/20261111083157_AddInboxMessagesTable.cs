using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace User.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInboxMessagesTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "inbox_messages",
                schema: "user",
                columns: table => new
                {
                    event_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    handler_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    processed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inbox_messages", x => new { x.event_id, x.handler_name });
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "inbox_messages",
                schema: "user");
        }
    }
}
