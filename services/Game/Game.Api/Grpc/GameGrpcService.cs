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

    public GameGrpcService(IGamePlayService gamePlayService, ILeaderboardService leaderboardService)
    {
        _gamePlayService = gamePlayService;
        _leaderboardService = leaderboardService;
    }

    public override async Task<ListLevelsResponse> ListLevels(ListLevelsRequest request, ServerCallContext context)
    {
        var levels = await _leaderboardService.ListLevelsAsync(context.CancellationToken);
        var response = new ListLevelsResponse();

        foreach (var l in levels)
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
}
