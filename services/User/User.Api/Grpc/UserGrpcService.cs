namespace User.Api.Grpc;

using System.Threading.Tasks;
using global::Grpc.Core;
using Sudoku.User.V1;

public class UserGrpcService : UserService.UserServiceBase
{
    public override Task<GetOrCreateProfileResponse> GetOrCreateProfile(GetOrCreateProfileRequest request, ServerCallContext context)
    {
        return Task.FromResult(new GetOrCreateProfileResponse());
    }

    public override Task<GetProfileResponse> GetProfile(GetProfileRequest request, ServerCallContext context)
    {
        return Task.FromResult(new GetProfileResponse());
    }

    public override Task<UpdateProfileResponse> UpdateProfile(UpdateProfileRequest request, ServerCallContext context)
    {
        return Task.FromResult(new UpdateProfileResponse());
    }
}
