namespace Game.Api.Grpc;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Exceptions;
using Game.Api.Domain.Services;
using global::Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Sudoku.Core;
using Sudoku.Game.V1;

[Authorize]
public class GameGrpcService : GameService.GameServiceBase
{
    private readonly IGamePlayService _gamePlayService;
    private readonly ILeaderboardService _leaderboardService;
    private readonly IAdminGameService? _adminGameService;

    public GameGrpcService(
        IGamePlayService gamePlayService,
        ILeaderboardService leaderboardService,
        IAdminGameService? adminGameService = null)
    {
        _gamePlayService = gamePlayService;
        _leaderboardService = leaderboardService;
        _adminGameService = adminGameService;
    }

    [AllowAnonymous]
    public override async Task<ListLevelsResponse> ListLevels(ListLevelsRequest request, ServerCallContext context)
    {
        var levels = await _leaderboardService.ListLevelsAsync(context.CancellationToken);
        var response = new ListLevelsResponse();

        foreach (var l in levels.Where(x => x.IsActive))
        {
            response.Levels.Add(new LevelInfo
            {
                LevelId = l.LevelId,
                Name = l.Name,
                SortOrder = l.SortOrder,
                MinClues = l.MinClues,
                MaxClues = l.MaxClues,
                MaxMistakes = l.MaxMistakes,
                MaxHints = l.MaxHints
            });
        }

        return response;
    }

    public override async Task<StartGameResponse> StartGame(StartGameRequest request, ServerCallContext context)
    {
        string userId = GetCallerUserId(context);

        var session = await _gamePlayService.StartGameAsync(
            userId,
            request.LevelId,
            (int)request.LayoutType,
            context.CancellationToken
        );

        return new StartGameResponse
        {
            Session = MapSessionState(session)
        };
    }

    public override async Task<GetActiveSessionResponse> GetActiveSession(GetActiveSessionRequest request, ServerCallContext context)
    {
        string userId = GetCallerUserId(context);

        var session = await _gamePlayService.GetActiveSessionAsync(userId, context.CancellationToken);
        if (session == null)
        {
            return new GetActiveSessionResponse { HasActiveSession = false };
        }

        return new GetActiveSessionResponse
        {
            HasActiveSession = true,
            Session = MapSessionState(session)
        };
    }

    public override async Task<GetSessionResponse> GetSession(GetSessionRequest request, ServerCallContext context)
    {
        string userId = GetCallerUserId(context);
        var sessionId = ParseSessionId(request.SessionId);

        var session = await _gamePlayService.GetSessionAsync(userId, sessionId, context.CancellationToken);
        return new GetSessionResponse
        {
            Session = MapSessionState(session)
        };
    }

    public override async Task<MakeMoveResponse> MakeMove(MakeMoveRequest request, ServerCallContext context)
    {
        string userId = GetCallerUserId(context);
        var sessionId = ParseSessionId(request.SessionId);

        var (eval, session) = await _gamePlayService.MakeMoveAsync(
            userId,
            sessionId,
            request.Row,
            request.Col,
            request.Value,
            context.CancellationToken
        );

        return new MakeMoveResponse
        {
            IsCorrect = eval.IsCorrect,
            IsDuplicateWrong = eval.IsDuplicateWrong,
            DifficultyTier = (DifficultyTier)eval.Tier,
            PointsDelta = eval.PointsDelta,
            Session = MapSessionState(session)
        };
    }

    public override async Task<UseHintResponse> UseHint(UseHintRequest request, ServerCallContext context)
    {
        string userId = GetCallerUserId(context);
        var sessionId = ParseSessionId(request.SessionId);

        var (hint, session) = await _gamePlayService.UseHintAsync(
            userId,
            sessionId,
            request.HasTargetRow ? request.TargetRow : null,
            request.HasTargetCol ? request.TargetCol : null,
            context.CancellationToken
        );

        var response = new UseHintResponse
        {
            Row = hint.Row,
            Col = hint.Col,
            Value = hint.Value,
            Technique = (HintTechnique)hint.Technique,
            Session = MapSessionState(session)
        };
        response.HighlightCells.AddRange(hint.HighlightCells);

        return response;
    }

    public override async Task<SaveNotesResponse> SaveNotes(SaveNotesRequest request, ServerCallContext context)
    {
        string userId = GetCallerUserId(context);
        var sessionId = ParseSessionId(request.SessionId);

        // Serialize notes to JSON dict
        var notesDict = new Dictionary<string, int>();
        foreach (var note in request.Notes)
        {
            if (CellCoord.IsValidIndex(note.CellIndex))
            {
                notesDict[note.CellIndex.ToString()] = note.CandidatesMask;
            }
        }
        string json = JsonSerializer.Serialize(notesDict);

        await _gamePlayService.SaveNotesAsync(userId, sessionId, json, context.CancellationToken);
        return new SaveNotesResponse();
    }

    public override async Task<AbandonGameResponse> AbandonGame(AbandonGameRequest request, ServerCallContext context)
    {
        string userId = GetCallerUserId(context);
        var sessionId = ParseSessionId(request.SessionId);

        var session = await _gamePlayService.AbandonGameAsync(userId, sessionId, context.CancellationToken);
        return new AbandonGameResponse
        {
            Session = MapSessionState(session)
        };
    }

    public override async Task<GetHighScoresResponse> GetHighScores(GetHighScoresRequest request, ServerCallContext context)
    {
        var scores = await _leaderboardService.GetHighScoresAsync(
            request.LevelId,
            (int)request.LayoutType,
            request.Limit,
            context.CancellationToken
        );

        var response = new GetHighScoresResponse();
        int rank = 1;

        foreach (var item in scores)
        {
            response.Entries.Add(new HighScoreEntry
            {
                Rank = rank++,
                UserId = item.UserId,
                PlayerName = string.Empty, // Left empty in Phase 1 as per decision
                Score = item.Score,
                ElapsedMs = item.ElapsedMs
            });
        }

        return response;
    }

    [AllowAnonymous]
    public override async Task<AcquirePuzzleForMatchResponse> AcquirePuzzleForMatch(
        AcquirePuzzleForMatchRequest request,
        ServerCallContext context)
    {
        if (context.RequestHeaders.GetValue("x-grpc-web") != null)
        {
            throw new RpcException(new Status(StatusCode.PermissionDenied, "AcquirePuzzleForMatch is an internal service RPC."));
        }

        var puzzle = await _gamePlayService.AcquirePuzzleForMatchAsync(
            request.LevelId,
            (int)request.LayoutType,
            request.RequireEvenEmptyCells,
            request.ExcludeUserIds,
            context.CancellationToken
        );

        return new AcquirePuzzleForMatchResponse
        {
            PuzzleId = puzzle.Id.ToString(),
            LevelId = puzzle.LevelId,
            LayoutType = (LayoutType)puzzle.LayoutType,
            InitialBoard = puzzle.InitialBoard,
            SolutionBoard = puzzle.SolutionBoard,
            RegionMap = puzzle.RegionMap,
            ClueCount = puzzle.ClueCount
        };
    }

    public override async Task<GetGameHistoryResponse> GetGameHistory(GetGameHistoryRequest request, ServerCallContext context)
    {
        string userId = GetCallerUserId(context);
        return await _gamePlayService.GetGameHistoryAsync(
            userId,
            request.Limit,
            request.Offset,
            context.CancellationToken
        );
    }

    private static string GetCallerUserId(ServerCallContext context)
    {
        var user = context.GetHttpContext().User;
        var sub = user.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(sub))
        {
            throw new RpcException(new Status(StatusCode.Unauthenticated, "User is not authenticated."));
        }
        return sub;
    }

    private static Guid ParseSessionId(string sessionId)
    {
        if (!Guid.TryParse(sessionId, out var parsed))
        {
            throw new ValidationException($"Invalid session_id format '{sessionId}'. Expected UUID.");
        }
        return parsed;
    }

    private static SessionState MapSessionState(GameSession s)
    {
        var rules = s.GetRules();
        var state = new SessionState
        {
            SessionId = s.Id.ToString(),
            LevelId = s.LevelId,
            LayoutType = (LayoutType)s.LayoutType,
            Status = (SessionStatus)s.Status,
            InitialBoard = s.Puzzle?.InitialBoard ?? s.CurrentBoard,
            CurrentBoard = s.CurrentBoard,
            RegionMap = s.Puzzle?.RegionMap ?? BoardConstants.StandardRegionMap,
            MistakesCount = s.MistakesCount,
            MaxMistakes = rules.MaxMistakes,
            HintsUsed = s.HintsUsed,
            MaxHints = rules.MaxHints,
            Score = s.Score,
            ElapsedMs = s.ElapsedMs,
            Accuracy = s.Accuracy
        };

        if (!string.IsNullOrWhiteSpace(s.NotesJson) && s.NotesJson != "[]" && s.NotesJson != "{}")
        {
            try
            {
                var dict = JsonSerializer.Deserialize<Dictionary<string, int>>(s.NotesJson);
                if (dict != null)
                {
                    foreach (var (k, v) in dict)
                    {
                        if (int.TryParse(k, out int idx))
                        {
                            state.Notes.Add(new CellNote { CellIndex = idx, CandidatesMask = v });
                        }
                    }
                }
            }
            catch
            {
                // Ignore notes deserialization failure
            }
        }

        return state;
    }

    [AllowAnonymous]
    public override async Task<ListGameModesResponse> ListGameModes(ListGameModesRequest request, ServerCallContext context)
    {
        if (_adminGameService == null) return new ListGameModesResponse();
        var modes = await _adminGameService.ListGameModesAsync(onlyActive: true, context.CancellationToken);
        var response = new ListGameModesResponse();
        foreach (var m in modes)
        {
            response.GameModes.Add(new GameModeInfo
            {
                Id = m.Id.ToString(),
                Code = m.Code,
                Name = m.Name,
                Description = m.Description,
                IsActive = m.IsActive,
                SortOrder = m.SortOrder,
                Version = m.Version,
                UpdatedAt = m.UpdatedAt.ToString("o")
            });
        }
        return response;
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminListGameModesResponse> AdminListGameModes(AdminListGameModesRequest request, ServerCallContext context)
    {
        if (_adminGameService == null) return new AdminListGameModesResponse();
        var modes = await _adminGameService.ListGameModesAsync(onlyActive: false, context.CancellationToken);
        var response = new AdminListGameModesResponse();
        foreach (var m in modes)
        {
            response.GameModes.Add(new GameModeInfo
            {
                Id = m.Id.ToString(),
                Code = m.Code,
                Name = m.Name,
                Description = m.Description,
                IsActive = m.IsActive,
                SortOrder = m.SortOrder,
                Version = m.Version,
                UpdatedAt = m.UpdatedAt.ToString("o")
            });
        }
        return response;
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminUpdateGameModeResponse> AdminUpdateGameMode(AdminUpdateGameModeRequest request, ServerCallContext context)
    {
        if (_adminGameService == null) throw new RpcException(new Status(StatusCode.Unimplemented, "AdminService not configured"));
        if (!Guid.TryParse(request.Id, out var id))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "ID biến thể không hợp lệ."));
        }

        string actorUid = GetCallerUserId(context);
        var updated = await _adminGameService.UpdateGameModeAsync(
            actorUid,
            id,
            request.Name,
            request.Description,
            request.IsActive,
            request.NotifyPlayers,
            request.NotificationMessage,
            request.Reason,
            context.CancellationToken);

        return new AdminUpdateGameModeResponse
        {
            GameMode = new GameModeInfo
            {
                Id = updated.Id.ToString(),
                Code = updated.Code,
                Name = updated.Name,
                Description = updated.Description,
                IsActive = updated.IsActive,
                SortOrder = updated.SortOrder,
                Version = updated.Version,
                UpdatedAt = updated.UpdatedAt.ToString("o")
            }
        };
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminListLevelConfigsResponse> AdminListLevelConfigs(AdminListLevelConfigsRequest request, ServerCallContext context)
    {
        if (_adminGameService == null) return new AdminListLevelConfigsResponse();
        var levels = await _adminGameService.ListLevelConfigsAsync(context.CancellationToken);
        var response = new AdminListLevelConfigsResponse();
        foreach (var l in levels)
        {
            response.Levels.Add(new LevelConfigInfo
            {
                LevelId = l.LevelId,
                Name = l.Name,
                SortOrder = l.SortOrder,
                MinClues = l.MinClues,
                MaxClues = l.MaxClues,
                MaxMistakes = l.MaxMistakes,
                MaxHints = l.MaxHints,
                IsActive = l.IsActive,
                ScoreMultiplier = l.ScoreMultiplier,
                TimeLimitSeconds = l.TimeLimitSeconds ?? 0,
                Version = l.Version,
                UpdatedAt = l.UpdatedAt.ToString("o")
            });
        }
        return response;
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminUpdateLevelResponse> AdminUpdateLevel(AdminUpdateLevelRequest request, ServerCallContext context)
    {
        if (_adminGameService == null) throw new RpcException(new Status(StatusCode.Unimplemented, "AdminService not configured"));
        string actorUid = GetCallerUserId(context);
        var updated = await _adminGameService.UpdateLevelAsync(
            actorUid,
            request.LevelId,
            request.MinClues,
            request.MaxClues,
            request.MaxMistakes,
            request.MaxHints,
            request.IsActive,
            request.ScoreMultiplier,
            request.TimeLimitSeconds,
            request.NotifyPlayers,
            request.NotificationMessage,
            request.Reason,
            context.CancellationToken);

        return new AdminUpdateLevelResponse
        {
            Level = new LevelConfigInfo
            {
                LevelId = updated.LevelId,
                Name = updated.Name,
                SortOrder = updated.SortOrder,
                MinClues = updated.MinClues,
                MaxClues = updated.MaxClues,
                MaxMistakes = updated.MaxMistakes,
                MaxHints = updated.MaxHints,
                IsActive = updated.IsActive,
                ScoreMultiplier = updated.ScoreMultiplier,
                TimeLimitSeconds = updated.TimeLimitSeconds ?? 0,
                Version = updated.Version,
                UpdatedAt = updated.UpdatedAt.ToString("o")
            }
        };
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminListTaskDefsResponse> AdminListTaskDefs(AdminListTaskDefsRequest request, ServerCallContext context)
    {
        if (_adminGameService == null) return new AdminListTaskDefsResponse();
        var tasks = await _adminGameService.ListTaskDefsAsync(context.CancellationToken);
        var response = new AdminListTaskDefsResponse();
        foreach (var t in tasks)
        {
            response.TaskDefs.Add(new TaskDefInfo
            {
                Id = t.Id.ToString(),
                Code = t.Code,
                Description = t.Description,
                ConditionType = t.ConditionType,
                Target = t.Target,
                ProgressSource = t.ProgressSource,
                IsActive = t.IsActive,
                SortOrder = t.SortOrder,
                UpdatedAt = t.UpdatedAt.ToString("o")
            });
        }
        return response;
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminCreateTaskDefResponse> AdminCreateTaskDef(AdminCreateTaskDefRequest request, ServerCallContext context)
    {
        if (_adminGameService == null) throw new RpcException(new Status(StatusCode.Unimplemented, "AdminService not configured"));
        string actorUid = GetCallerUserId(context);
        var created = await _adminGameService.CreateTaskDefAsync(
            actorUid,
            request.Code,
            request.Description,
            request.ConditionType,
            request.Target,
            request.ProgressSource,
            request.SortOrder,
            request.Reason,
            context.CancellationToken);

        return new AdminCreateTaskDefResponse
        {
            TaskDef = new TaskDefInfo
            {
                Id = created.Id.ToString(),
                Code = created.Code,
                Description = created.Description,
                ConditionType = created.ConditionType,
                Target = created.Target,
                ProgressSource = created.ProgressSource,
                IsActive = created.IsActive,
                SortOrder = created.SortOrder,
                UpdatedAt = created.UpdatedAt.ToString("o")
            }
        };
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminUpdateTaskDefResponse> AdminUpdateTaskDef(AdminUpdateTaskDefRequest request, ServerCallContext context)
    {
        if (_adminGameService == null) throw new RpcException(new Status(StatusCode.Unimplemented, "AdminService not configured"));
        if (!Guid.TryParse(request.Id, out var id))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "ID nhiệm vụ không hợp lệ."));
        }

        string actorUid = GetCallerUserId(context);
        var updated = await _adminGameService.UpdateTaskDefAsync(
            actorUid,
            id,
            request.Description,
            request.IsActive,
            request.Target,
            request.SortOrder,
            request.Reason,
            context.CancellationToken);

        return new AdminUpdateTaskDefResponse
        {
            TaskDef = new TaskDefInfo
            {
                Id = updated.Id.ToString(),
                Code = updated.Code,
                Description = updated.Description,
                ConditionType = updated.ConditionType,
                Target = updated.Target,
                ProgressSource = updated.ProgressSource,
                IsActive = updated.IsActive,
                SortOrder = updated.SortOrder,
                UpdatedAt = updated.UpdatedAt.ToString("o")
            }
        };
    }
}
