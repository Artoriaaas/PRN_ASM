namespace User.Api.Grpc;

using global::Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Sudoku.User.V1;
using User.Api.Domain.Entities;
using User.Api.Domain.Exceptions;
using User.Api.Domain.Services;

[Authorize]
public sealed class UserGrpcService(
    IUserProfileService profileService,
    IAdminUserService adminService) : UserService.UserServiceBase
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

    [AllowAnonymous]
    public override async Task<GetProfilesResponse> GetProfiles(
        GetProfilesRequest request,
        ServerCallContext context)
    {
        var profiles = await profileService.GetProfilesAsync(
            request.FirebaseUids,
            context.CancellationToken);

        var response = new GetProfilesResponse();
        foreach (var user in profiles)
        {
            response.Profiles.Add(new UserProfileSummary
            {
                FirebaseUid = user.FirebaseUid,
                UserId = user.Id.ToString(),
                DisplayName = user.DisplayName,
                AvatarUrl = user.AvatarUrl,
                Country = user.Country,
                PlayerLevel = user.PlayerLevel,
                Trophies = user.Trophies,
            });
        }

        return response;
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminListUsersResponse> AdminListUsers(
        AdminListUsersRequest request,
        ServerCallContext context)
    {
        var (users, total) = await adminService.ListUsersAsync(
            request.Page,
            request.PageSize,
            request.Search,
            request.StatusFilter,
            request.SortBy,
            context.CancellationToken);

        var response = new AdminListUsersResponse { TotalCount = total };
        foreach (var u in users)
        {
            response.Users.Add(new AdminUserSummary
            {
                Id = u.Id.ToString(),
                FirebaseUid = u.FirebaseUid,
                DisplayName = u.DisplayName,
                Email = u.Email,
                Role = u.Role,
                Status = u.Status,
                Elo = u.Trophies,
                PlayerLevel = u.PlayerLevel,
                CreatedAt = u.CreatedAt.ToString("o"),
                BannedUntil = u.BannedUntil?.ToString("o") ?? string.Empty,
                LastLoginAt = u.LastLoginAt?.ToString("o") ?? string.Empty,
                AvatarUrl = u.AvatarUrl
            });
        }

        return response;
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminGetUserResponse> AdminGetUser(
        AdminGetUserRequest request,
        ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "ID người dùng không hợp lệ."));
        }

        try
        {
            var (user, history) = await adminService.GetUserDetailAsync(userId, context.CancellationToken);
            var detail = new AdminUserDetail
            {
                Id = user.Id.ToString(),
                FirebaseUid = user.FirebaseUid,
                DisplayName = user.DisplayName,
                Email = user.Email,
                AvatarUrl = user.AvatarUrl,
                Country = user.Country,
                Role = user.Role,
                Status = user.Status,
                Elo = user.Trophies,
                PlayerLevel = user.PlayerLevel,
                TotalGames = user.TotalGames,
                Wins = user.Wins,
                BanReason = user.BanReason ?? string.Empty,
                BannedUntil = user.BannedUntil?.ToString("o") ?? string.Empty,
                LastLoginAt = user.LastLoginAt?.ToString("o") ?? string.Empty,
                CreatedAt = user.CreatedAt.ToString("o"),
                UpdatedAt = user.UpdatedAt.ToString("o")
            };

            foreach (var h in history)
            {
                detail.RecentEloHistory.Add(new EloHistoryEntry
                {
                    Id = h.Id.ToString(),
                    Delta = h.Delta,
                    NewElo = h.NewElo,
                    SourceType = h.SourceType,
                    Reason = h.Reason,
                    CreatedAt = h.CreatedAt.ToString("o")
                });
            }

            return new AdminGetUserResponse { User = detail };
        }
        catch (ProfileNotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminBanUserResponse> AdminBanUser(
        AdminBanUserRequest request,
        ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "ID người dùng không hợp lệ."));
        }

        DateTimeOffset? bannedUntil = null;
        if (!string.IsNullOrWhiteSpace(request.BannedUntil) && DateTimeOffset.TryParse(request.BannedUntil, out var parsedDate))
        {
            bannedUntil = parsedDate;
        }

        try
        {
            var actorUid = GetRequiredFirebaseUid(context);
            var user = await adminService.BanUserAsync(actorUid, userId, request.Reason, bannedUntil, context.CancellationToken);
            return new AdminBanUserResponse { Success = true, UserId = user.Id.ToString() };
        }
        catch (ProfileNotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
        catch (ProfileValidationException ex)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, ex.Message));
        }
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminUnbanUserResponse> AdminUnbanUser(
        AdminUnbanUserRequest request,
        ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "ID người dùng không hợp lệ."));
        }

        try
        {
            var actorUid = GetRequiredFirebaseUid(context);
            await adminService.UnbanUserAsync(actorUid, userId, request.Reason, context.CancellationToken);
            return new AdminUnbanUserResponse { Success = true };
        }
        catch (ProfileNotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
        catch (ProfileValidationException ex)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, ex.Message));
        }
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminSoftDeleteUserResponse> AdminSoftDeleteUser(
        AdminSoftDeleteUserRequest request,
        ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "ID người dùng không hợp lệ."));
        }

        try
        {
            var actorUid = GetRequiredFirebaseUid(context);
            await adminService.SoftDeleteUserAsync(actorUid, userId, request.Reason, context.CancellationToken);
            return new AdminSoftDeleteUserResponse { Success = true };
        }
        catch (ProfileNotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
        catch (ProfileValidationException ex)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, ex.Message));
        }
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminAdjustEloResponse> AdminAdjustElo(
        AdminAdjustEloRequest request,
        ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "ID người dùng không hợp lệ."));
        }

        try
        {
            var actorUid = GetRequiredFirebaseUid(context);
            var (newElo, oldElo) = await adminService.AdjustEloAsync(actorUid, userId, request.Delta, request.Reason, request.Operation, context.CancellationToken);
            return new AdminAdjustEloResponse { NewElo = newElo, OldElo = oldElo };
        }
        catch (ProfileNotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
        catch (ProfileValidationException ex)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, ex.Message));
        }
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminGrantRoleResponse> AdminGrantRole(
        AdminGrantRoleRequest request,
        ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "ID người dùng không hợp lệ."));
        }

        try
        {
            var actorUid = GetRequiredFirebaseUid(context);
            await adminService.GrantAdminRoleAsync(actorUid, userId, request.Reason, context.CancellationToken);
            return new AdminGrantRoleResponse { Success = true };
        }
        catch (ProfileNotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
        catch (ProfileValidationException ex)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, ex.Message));
        }
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminRevokeRoleResponse> AdminRevokeRole(
        AdminRevokeRoleRequest request,
        ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "ID người dùng không hợp lệ."));
        }

        try
        {
            var actorUid = GetRequiredFirebaseUid(context);
            await adminService.RevokeAdminRoleAsync(actorUid, userId, request.Reason, context.CancellationToken);
            return new AdminRevokeRoleResponse { Success = true };
        }
        catch (ProfileNotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
        catch (ProfileValidationException ex)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, ex.Message));
        }
    }

    [Authorize(Policy = "Admin")]
    public override async Task<AdminListAuditLogsResponse> AdminListAuditLogs(
        AdminListAuditLogsRequest request,
        ServerCallContext context)
    {
        Guid? actorId = Guid.TryParse(request.ActorId, out var aId) ? aId : null;
        Guid? targetId = Guid.TryParse(request.TargetId, out var tId) ? tId : null;
        DateTimeOffset? fromDate = DateTimeOffset.TryParse(request.FromDate, out var fDate) ? fDate : null;
        DateTimeOffset? toDate = DateTimeOffset.TryParse(request.ToDate, out var tDate) ? tDate : null;

        var (logs, total) = await adminService.ListAuditLogsAsync(
            actorId,
            targetId,
            fromDate,
            toDate,
            request.Page,
            request.PageSize,
            context.CancellationToken);

        var response = new AdminListAuditLogsResponse { TotalCount = total };
        foreach (var l in logs)
        {
            response.Logs.Add(new AuditLogEntry
            {
                Id = l.Id.ToString(),
                ActorId = l.ActorId.ToString(),
                Action = l.Action,
                TargetType = l.TargetType,
                TargetId = l.TargetId.ToString(),
                BeforeJson = l.Before,
                AfterJson = l.After,
                Reason = l.Reason,
                CreatedAt = l.CreatedAt.ToString("o")
            });
        }

        return response;
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
