namespace Game.Api.Grpc;

using System.Threading.Tasks;
using global::Grpc.Core;
using Sudoku.Game.V1;

public class GameGrpcService : GameService.GameServiceBase
{
    public override Task<StartGameResponse> StartGame(StartGameRequest request, ServerCallContext context)
    {
        return Task.FromResult(new StartGameResponse());
    }

    public override Task<SubmitResultResponse> SubmitResult(SubmitResultRequest request, ServerCallContext context)
    {
        return Task.FromResult(new SubmitResultResponse());
    }

    public override Task<ListLevelsResponse> ListLevels(ListLevelsRequest request, ServerCallContext context)
    {
        return Task.FromResult(new ListLevelsResponse());
    }

    public override Task<GetHighScoresResponse> GetHighScores(GetHighScoresRequest request, ServerCallContext context)
    {
        return Task.FromResult(new GetHighScoresResponse());
    }
}
