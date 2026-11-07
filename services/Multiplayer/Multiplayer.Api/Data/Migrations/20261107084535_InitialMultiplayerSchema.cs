using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Multiplayer.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialMultiplayerSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "inbox_messages",
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
                name: "matches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tournament_id = table.Column<Guid>(type: "uuid", nullable: true),
                    round_number = table.Column<int>(type: "integer", nullable: true),
                    bracket_slot = table.Column<int>(type: "integer", nullable: true),
                    play_format = table.Column<int>(type: "integer", nullable: false),
                    board_layout = table.Column<int>(type: "integer", nullable: false),
                    level_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    puzzle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    initial_board = table.Column<string>(type: "character(81)", fixedLength: true, maxLength: 81, nullable: false),
                    solution_board = table.Column<string>(type: "character(81)", fixedLength: true, maxLength: 81, nullable: false),
                    region_map = table.Column<string>(type: "character(81)", fixedLength: true, maxLength: 81, nullable: false),
                    rules_json = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    shared_board = table.Column<string>(type: "character varying(81)", maxLength: 81, nullable: false),
                    current_turn_user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    turn_number = table.Column<int>(type: "integer", nullable: false),
                    turn_deadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    winner_user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    end_reason = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    duration_ms = table.Column<long>(type: "bigint", nullable: false),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    finished_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_matches", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "outbox_messages",
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
                name: "player_ratings",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    play_format = table.Column<int>(type: "integer", nullable: false),
                    display_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    rating = table.Column<int>(type: "integer", nullable: false),
                    matches_played = table.Column<int>(type: "integer", nullable: false),
                    matches_won = table.Column<int>(type: "integer", nullable: false),
                    matches_drawn = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_ratings", x => new { x.user_id, x.play_format });
                });

            migrationBuilder.CreateTable(
                name: "match_moves",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    match_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    turn_number = table.Column<int>(type: "integer", nullable: false),
                    move_type = table.Column<int>(type: "integer", nullable: false),
                    row = table.Column<int>(type: "integer", nullable: false),
                    col = table.Column<int>(type: "integer", nullable: false),
                    value = table.Column<int>(type: "integer", nullable: false),
                    is_correct = table.Column<bool>(type: "boolean", nullable: false),
                    difficulty_tier = table.Column<int>(type: "integer", nullable: false),
                    points_awarded = table.Column<int>(type: "integer", nullable: false),
                    time_taken_ms = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_match_moves", x => x.id);
                    table.ForeignKey(
                        name: "fk_match_moves_matches_match_id",
                        column: x => x.match_id,
                        principalTable: "matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "match_players",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    match_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    display_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    opponent_user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    opponent_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    opponent_score = table.Column<int>(type: "integer", nullable: false),
                    play_format = table.Column<int>(type: "integer", nullable: false),
                    board_layout = table.Column<int>(type: "integer", nullable: false),
                    level_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    turn_order = table.Column<int>(type: "integer", nullable: false),
                    current_board = table.Column<string>(type: "character(81)", fixedLength: true, maxLength: 81, nullable: false),
                    notes_json = table.Column<string>(type: "jsonb", nullable: false),
                    lives_remaining = table.Column<int>(type: "integer", nullable: false),
                    mistakes_count = table.Column<int>(type: "integer", nullable: false),
                    correct_cells = table.Column<int>(type: "integer", nullable: false),
                    score = table.Column<int>(type: "integer", nullable: false),
                    penalty_seconds = table.Column<int>(type: "integer", nullable: false),
                    timeout_count = table.Column<int>(type: "integer", nullable: false),
                    result = table.Column<int>(type: "integer", nullable: false),
                    end_reason = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    completion_ms = table.Column<long>(type: "bigint", nullable: false),
                    rating_before = table.Column<int>(type: "integer", nullable: false),
                    rating_delta = table.Column<int>(type: "integer", nullable: false),
                    finished_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_match_players", x => x.id);
                    table.ForeignKey(
                        name: "fk_match_players_matches_match_id",
                        column: x => x.match_id,
                        principalTable: "matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_match_moves_match_id_turn_number",
                table: "match_moves",
                columns: new[] { "match_id", "turn_number" });

            migrationBuilder.CreateIndex(
                name: "ix_match_players_match_id_user_id",
                table: "match_players",
                columns: new[] { "match_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_match_players_user_id_finished_at",
                table: "match_players",
                columns: new[] { "user_id", "finished_at" });

            migrationBuilder.CreateIndex(
                name: "ix_match_players_user_id_play_format_finished_at",
                table: "match_players",
                columns: new[] { "user_id", "play_format", "finished_at" });

            migrationBuilder.CreateIndex(
                name: "ix_matches_status_started_at",
                table: "matches",
                columns: new[] { "status", "started_at" });

            migrationBuilder.CreateIndex(
                name: "ix_matches_tournament_id_round_number_bracket_slot",
                table: "matches",
                columns: new[] { "tournament_id", "round_number", "bracket_slot" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_messages_created_at",
                table: "outbox_messages",
                column: "created_at",
                filter: "processed_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_player_ratings_play_format_rating_matches_won",
                table: "player_ratings",
                columns: new[] { "play_format", "rating", "matches_won" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "inbox_messages");

            migrationBuilder.DropTable(
                name: "match_moves");

            migrationBuilder.DropTable(
                name: "match_players");

            migrationBuilder.DropTable(
                name: "outbox_messages");

            migrationBuilder.DropTable(
                name: "player_ratings");

            migrationBuilder.DropTable(
                name: "matches");
        }
    }
}
