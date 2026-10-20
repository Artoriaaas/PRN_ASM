namespace Support.Api.Grpc;

using System.Threading.Tasks;
using global::Grpc.Core;
using Sudoku.Support.V1;

public class SupportGrpcService : SupportService.SupportServiceBase
{
    public override Task<GetRulesResponse> GetRules(GetRulesRequest request, ServerCallContext context)
    {
        return Task.FromResult(new GetRulesResponse());
    }

    public override Task<ListTutorialsResponse> ListTutorials(ListTutorialsRequest request, ServerCallContext context)
    {
        return Task.FromResult(new ListTutorialsResponse());
    }

    public override Task<ListNoticesResponse> ListNotices(ListNoticesRequest request, ServerCallContext context)
    {
        return Task.FromResult(new ListNoticesResponse());
    }
}
