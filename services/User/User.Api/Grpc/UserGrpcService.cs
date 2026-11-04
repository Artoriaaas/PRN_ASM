namespace User.Api.Grpc;

using global::Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Sudoku.User.V1;
using User.Api.Domain.Entities;
using User.Api.Domain.Exceptions;
using User.Api.Domain.Services;

[Authorize]
public sealed class UserGrpcService(IUserProfileService profileService) : UserService.UserServiceBase
{
    public override async Task<GetOrCreateProfileResponse> GetOrCreateProfile(
        GetOrCreateProfileRequest request,
        ServerCallContext context)
    {
        try
        {
            var principal = context.GetHttpContext().User;
            var firebaseUid = GetRequiredFirebaseUid(context);
            var email = principal.FindFirst("email")?.Value ?? string.Empty;
            var displayName = string.IsNullOrWhiteSpace(request.DisplayName)
                ? principal.FindFirst("name")?.Value ?? string.Empty
                : request.DisplayName;
            var avatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl)
                ? principal.FindFirst("picture")?.Value ?? string.Empty
                : request.AvatarUrl;

            var result = await profileService.GetOrCreateAsync(
                firebaseUid,
                email,
                displayName,
                avatarUrl,
                context.CancellationToken);

            return new GetOrCreateProfileResponse
            {
                Profile = MapProfile(result.Profile),
                IsNewUser = result.IsNewUser,
            };
        }
        catch (ProfileValidationException exception)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, exception.Message));
        }
    }

    public override async Task<GetProfileResponse> GetProfile(
        GetProfileRequest request,
        ServerCallContext context)
    {
        try
        {
            var profile = await profileService.GetAsync(
                GetRequiredFirebaseUid(context),
                context.CancellationToken);

            return new GetProfileResponse { Profile = MapProfile(profile) };
        }
        catch (ProfileNotFoundException exception)
        {
            throw new RpcException(new Status(StatusCode.NotFound, exception.Message));
        }
    }

    public override async Task<UpdateProfileResponse> UpdateProfile(
        UpdateProfileRequest request,
        ServerCallContext context)
    {
        try
        {
            var profile = await profileService.UpdateAsync(
                GetRequiredFirebaseUid(context),
                request.DisplayName,
                request.AvatarUrl,
                request.Country,
                context.CancellationToken);

            return new UpdateProfileResponse { Profile = MapProfile(profile) };
        }
        catch (ProfileNotFoundException exception)
        {
            throw new RpcException(new Status(StatusCode.NotFound, exception.Message));
        }
        catch (ProfileValidationException exception)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, exception.Message));
        }
    }

    private static string GetRequiredFirebaseUid(ServerCallContext context)
    {
        return context.GetHttpContext().User.FindFirst("sub")?.Value
            ?? throw new RpcException(new Status(StatusCode.Unauthenticated, "Người dùng chưa đăng nhập."));
    }

    private static UserProfile MapProfile(UserAccount user)
    {
        return new UserProfile
        {
            Id = user.Id.ToString(),
            DisplayName = user.DisplayName,
            Email = user.Email,
            AvatarUrl = user.AvatarUrl,
            Country = user.Country,
            TotalGames = user.TotalGames,
            Wins = user.Wins,
            TotalExp = user.TotalExp,
            PlayerLevel = user.PlayerLevel,
            Trophies = user.Trophies,
        };
    }
}
