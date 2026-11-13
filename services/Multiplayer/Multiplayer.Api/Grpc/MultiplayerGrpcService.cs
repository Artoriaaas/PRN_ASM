namespace Multiplayer.Api.Grpc;

using System;
using System.Threading.Tasks;
using global::Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Multiplayer.Api.Domain.Exceptions;
using Multiplayer.Api.Domain.Services;
using Sudoku.Multi.V1;

[Authorize]
public sealed class MultiplayerGrpcService : MultiplayerService.MultiplayerServiceBase
{
    private readonly IMultiplayerQueryService _queryService;

    public MultiplayerGrpcService(IMultiplayerQueryService queryService)
    {
        _queryService = queryService;
    }

    public override Task<GetRankingsResponse> GetRankings(
        GetRankingsRequest request,
        ServerCallContext context)
    {
        string? callerUserId = context.GetHttpContext().User.FindFirst("sub")?.Value;
        return _queryService.GetRankingsAsync(
            callerUserId,
            (int)request.PlayFormat,
            request.Limit,
            context.CancellationToken);
    }

    public override Task<GetMatchHistoryResponse> GetMatchHistory(
        GetMatchHistoryRequest request,
        ServerCallContext context)
    {
        string userId = GetRequiredUserId(context);
        return _queryService.GetMatchHistoryAsync(
            userId,
            (int)request.PlayFormat,
            request.Limit,
            request.Offset,
            context.CancellationToken);
    }

    public override Task<GetPlayerRatingsResponse> GetPlayerRatings(
        GetPlayerRatingsRequest request,
        ServerCallContext context)
    {
        string userId = GetRequiredUserId(context);
        return _queryService.GetPlayerRatingsAsync(userId, context.CancellationToken);
    }

    public override async Task<GetMatchResponse> GetMatch(
        GetMatchRequest request,
        ServerCallContext context)
    {
        _ = GetRequiredUserId(context);
        if (!Guid.TryParse(request.MatchId, out var matchId))
        {
            throw new ValidationException($"Invalid match_id format '{request.MatchId}'. Expected UUID.");
        }

        var detail = await _queryService.GetMatchAsync(matchId, context.CancellationToken);
        return new GetMatchResponse { Match = detail };
    }

    private static string GetRequiredUserId(ServerCallContext context)
    {
        var sub = context.GetHttpContext().User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(sub))
        {
            throw new RpcException(new Status(StatusCode.Unauthenticated, "User is not authenticated."));
        }
        return sub;
    }
}
