namespace Multiplayer.Api.Grpc;

using System.Threading.Tasks;
using global::Grpc.Core;
using Sudoku.Multi.V1;

public class MultiplayerGrpcService : MultiplayerService.MultiplayerServiceBase
{
    public override Task<GetRankingsResponse> GetRankings(GetRankingsRequest request, ServerCallContext context)
    {
        return Task.FromResult(new GetRankingsResponse());
    }

    public override Task<GetMatchHistoryResponse> GetMatchHistory(GetMatchHistoryRequest request, ServerCallContext context)
    {
        return Task.FromResult(new GetMatchHistoryResponse());
    }
}
