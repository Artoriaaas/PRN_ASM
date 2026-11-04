using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Game.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialGameSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "levels",
                columns: table => new
                {
                    level_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    min_clues = table.Column<int>(type: "integer", nullable: false),
                    max_clues = table.Column<int>(type: "integer", nullable: false),
                    max_mistakes = table.Column<int>(type: "integer", nullable: false),
                    max_hints = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_levels", x => x.level_id);
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
                name: "puzzles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    level_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    layout_type = table.Column<int>(type: "integer", nullable: false),
                    initial_board = table.Column<string>(type: "character(81)", fixedLength: true, maxLength: 81, nullable: false),
                    solution_board = table.Column<string>(type: "character(81)", fixedLength: true, maxLength: 81, nullable: false),
                    region_map = table.Column<string>(type: "character(81)", fixedLength: true, maxLength: 81, nullable: false),
                    puzzle_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    clue_count = table.Column<int>(type: "integer", nullable: false),
                    difficulty_score = table.Column<int>(type: "integer", nullable: false),
                    is_logic_solvable = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    generator_version = table.Column<int>(type: "integer", nullable: false),
                    play_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_puzzles", x => x.id);
                    table.ForeignKey(
                        name: "fk_puzzles_levels_level_id",
                        column: x => x.level_id,
                        principalTable: "levels",
                        principalColumn: "level_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "game_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    puzzle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    level_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    layout_type = table.Column<int>(type: "integer", nullable: false),
                    mode_code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "classic"),
                    rules_json = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    current_board = table.Column<string>(type: "character(81)", fixedLength: true, maxLength: 81, nullable: false),
                    notes_json = table.Column<string>(type: "jsonb", nullable: false),
                    mistakes_count = table.Column<int>(type: "integer", nullable: false),
                    hints_used = table.Column<int>(type: "integer", nullable: false),
                    move_count = table.Column<int>(type: "integer", nullable: false),
                    correct_move_count = table.Column<int>(type: "integer", nullable: false),
                    score = table.Column<int>(type: "integer", nullable: false),
                    accuracy = table.Column<double>(type: "double precision", nullable: false),
                    elapsed_ms = table.Column<long>(type: "bigint", nullable: false),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    finished_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_game_sessions", x => x.id);
                    table.ForeignKey(
                        name: "fk_game_sessions_puzzles_puzzle_id",
                        column: x => x.puzzle_id,
                        principalTable: "puzzles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "game_moves",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    move_order = table.Column<int>(type: "integer", nullable: false),
                    move_type = table.Column<int>(type: "integer", nullable: false),
                    row = table.Column<int>(type: "integer", nullable: false),
                    col = table.Column<int>(type: "integer", nullable: false),
                    value = table.Column<int>(type: "integer", nullable: false),
                    is_correct = table.Column<bool>(type: "boolean", nullable: false),
                    difficulty_tier = table.Column<int>(type: "integer", nullable: false),
                    points_awarded = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_game_moves", x => x.id);
                    table.ForeignKey(
                        name: "fk_game_moves_game_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "game_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_game_moves_session_id_move_order",
                table: "game_moves",
                columns: new[] { "session_id", "move_order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_game_moves_session_id_row_col_value",
                table: "game_moves",
                columns: new[] { "session_id", "row", "col", "value" },
                filter: "is_correct = false");

            migrationBuilder.CreateIndex(
                name: "ix_game_sessions_level_id_layout_type_score_elapsed_ms",
                table: "game_sessions",
                columns: new[] { "level_id", "layout_type", "score", "elapsed_ms" },
                filter: "status = 2");

            migrationBuilder.CreateIndex(
                name: "ix_game_sessions_puzzle_id",
                table: "game_sessions",
                column: "puzzle_id");

            migrationBuilder.CreateIndex(
                name: "ix_game_sessions_user_id",
                table: "game_sessions",
                column: "user_id",
                unique: true,
                filter: "status = 1");

            migrationBuilder.CreateIndex(
                name: "ix_game_sessions_user_id_puzzle_id",
                table: "game_sessions",
                columns: new[] { "user_id", "puzzle_id" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_messages_created_at",
                table: "outbox_messages",
                column: "created_at",
                filter: "processed_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_puzzles_level_id_layout_type_play_count",
                table: "puzzles",
                columns: new[] { "level_id", "layout_type", "play_count" },
                filter: "is_active = true");

            migrationBuilder.CreateIndex(
                name: "ix_puzzles_puzzle_hash",
                table: "puzzles",
                column: "puzzle_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "game_moves");

            migrationBuilder.DropTable(
                name: "outbox_messages");

            migrationBuilder.DropTable(
                name: "game_sessions");

            migrationBuilder.DropTable(
                name: "puzzles");

            migrationBuilder.DropTable(
                name: "levels");
        }
    }
}
