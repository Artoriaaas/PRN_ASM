namespace User.Api.Domain.Services;

using User.Api.Domain.Entities;
using User.Api.Domain.Exceptions;
using User.Api.Domain.Repositories;

public sealed class UserProfileService(
    IUserRepository repository,
    IUserUnitOfWork unitOfWork) : IUserProfileService
{
    public async Task<(UserAccount Profile, bool IsNewUser)> GetOrCreateAsync(
        string firebaseUid,
        string email,
        string displayName,
        string avatarUrl,
        CancellationToken cancellationToken)
    {
        ValidateFirebaseUid(firebaseUid);

        var existing = await repository.GetByFirebaseUidAsync(firebaseUid, cancellationToken);
        if (existing is not null)
        {
            return (existing, false);
        }

        var now = DateTimeOffset.UtcNow;
        var user = new UserAccount
        {
            Id = Guid.NewGuid(),
            FirebaseUid = firebaseUid,
            Email = NormalizeEmail(email),
            DisplayName = NormalizeDisplayName(displayName, email),
            AvatarUrl = NormalizeAvatarUrl(avatarUrl),
            Role = "user",
            Status = "active",
            PlayerLevel = 1,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await repository.AddAsync(user, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return (user, true);
    }

    public async Task<UserAccount> GetAsync(string firebaseUid, CancellationToken cancellationToken)
    {
        ValidateFirebaseUid(firebaseUid);
        return await repository.GetByFirebaseUidAsync(firebaseUid, cancellationToken)
            ?? throw new ProfileNotFoundException();
    }

    public Task<IReadOnlyList<UserAccount>> GetProfilesAsync(
        IReadOnlyList<string> firebaseUids,
        CancellationToken cancellationToken)
    {
        var distinct = firebaseUids
            .Where(id => !string.IsNullOrWhiteSpace(id) && id.Length <= 128)
            .Distinct(StringComparer.Ordinal)
            .Take(100)
            .ToArray();

        return repository.GetByFirebaseUidsAsync(distinct, distinct.Length, cancellationToken);
    }

    public async Task<UserAccount> UpdateAsync(
        string firebaseUid,
        string displayName,
        string avatarUrl,
        string country,
        CancellationToken cancellationToken)
    {
        ValidateFirebaseUid(firebaseUid);

        var user = await repository.GetByFirebaseUidForUpdateAsync(firebaseUid, cancellationToken)
            ?? throw new ProfileNotFoundException();

        user.DisplayName = NormalizeDisplayName(displayName, user.Email);
        user.AvatarUrl = NormalizeAvatarUrl(avatarUrl);
        user.Country = NormalizeCountry(country);
        user.UpdatedAt = DateTimeOffset.UtcNow;

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user;
    }

    public async Task HandleGameFinishedEventAsync(
        string eventId,
        string handlerName,
        Sudoku.Events.V1.GameFinished gameFinished,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(gameFinished.UserId))
        {
            return;
        }

        if (await repository.HasProcessedInboxAsync(eventId, handlerName, cancellationToken))
        {
            return;
        }

        var user = await repository.GetByFirebaseUidForUpdateAsync(gameFinished.UserId, cancellationToken);
        if (user is null)
        {
            var now = DateTimeOffset.UtcNow;
            user = new UserAccount
            {
                Id = Guid.NewGuid(),
                FirebaseUid = gameFinished.UserId,
                Email = $"{gameFinished.UserId}@player.local",
                DisplayName = "Player",
                AvatarUrl = string.Empty,
                Role = "user",
                Status = "active",
                PlayerLevel = 1,
                CreatedAt = now,
                UpdatedAt = now,
            };
            await repository.AddAsync(user, cancellationToken);
        }

        user.TotalGames += 1;
        if (gameFinished.IsWin)
        {
            user.Wins += 1;
            user.Trophies += Math.Max(0, gameFinished.RewardCoins);
            int expGain = Math.Max(10, gameFinished.Score / 5);
            user.TotalExp += expGain;
            user.PlayerLevel = Math.Max(1, 1 + (user.TotalExp / 500));
        }

        user.UpdatedAt = DateTimeOffset.UtcNow;

        await repository.AddInboxMessageAsync(new Sudoku.Messaging.InboxMessage
        {
            EventId = eventId,
            HandlerName = handlerName,
            ReceivedAt = DateTime.UtcNow,
            ProcessedAt = DateTime.UtcNow
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task HandleMatchCompletedEventAsync(
        string eventId,
        string handlerName,
        Sudoku.Events.V1.MatchCompleted matchCompleted,
        CancellationToken cancellationToken)
    {
        if (await repository.HasProcessedInboxAsync(eventId, handlerName, cancellationToken))
        {
            return;
        }

        DateTimeOffset now = DateTimeOffset.UtcNow;

        if (!string.IsNullOrWhiteSpace(matchCompleted.WinnerUserId))
        {
            var winner = await repository.GetByFirebaseUidForUpdateAsync(matchCompleted.WinnerUserId, cancellationToken);
            if (winner != null)
            {
                winner.TotalGames += 1;
                if (!matchCompleted.IsDraw)
                {
                    winner.Wins += 1;
                    winner.Trophies += Math.Max(0, matchCompleted.WinnerRewardCoins);
                    winner.TotalExp += 50;
                    winner.PlayerLevel = Math.Max(1, 1 + (winner.TotalExp / 500));
                }
                winner.UpdatedAt = now;
            }
        }

        if (!string.IsNullOrWhiteSpace(matchCompleted.LoserUserId) && !string.Equals(matchCompleted.LoserUserId, matchCompleted.WinnerUserId, StringComparison.Ordinal))
        {
            var loser = await repository.GetByFirebaseUidForUpdateAsync(matchCompleted.LoserUserId, cancellationToken);
            if (loser != null)
            {
                loser.TotalGames += 1;
                loser.TotalExp += 15;
                loser.PlayerLevel = Math.Max(1, 1 + (loser.TotalExp / 500));
                loser.UpdatedAt = now;
            }
        }

        await repository.AddInboxMessageAsync(new Sudoku.Messaging.InboxMessage
        {
            EventId = eventId,
            HandlerName = handlerName,
            ReceivedAt = DateTime.UtcNow,
            ProcessedAt = DateTime.UtcNow
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static void ValidateFirebaseUid(string firebaseUid)
    {
        if (string.IsNullOrWhiteSpace(firebaseUid) || firebaseUid.Length > 128)
        {
            throw new ProfileValidationException("Firebase UID không hợp lệ.");
        }
    }

    private static string NormalizeEmail(string email)
    {
        var value = email.Trim();
        if (value.Length > 320)
        {
            throw new ProfileValidationException("Email vượt quá độ dài cho phép.");
        }

        return value;
    }

    private static string NormalizeDisplayName(string displayName, string email)
    {
        var value = displayName.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            value = email.Split('@', 2)[0].Trim();
        }

        if (string.IsNullOrWhiteSpace(value))
        {
            value = "Người chơi";
        }

        if (value.Length > 80)
        {
            throw new ProfileValidationException("Tên hiển thị tối đa 80 ký tự.");
        }

        return value;
    }

    private static string NormalizeAvatarUrl(string avatarUrl)
    {
        var value = avatarUrl.Trim();
        if (value.Length > 2048)
        {
            throw new ProfileValidationException("URL ảnh đại diện quá dài.");
        }

        if (value.Length > 0 &&
            (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
             (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)))
        {
            throw new ProfileValidationException("URL ảnh đại diện phải bắt đầu bằng http:// hoặc https://.");
        }

        return value;
    }

    private static string NormalizeCountry(string country)
    {
        var value = country.Trim();
        if (value.Length > 80)
        {
            throw new ProfileValidationException("Quốc gia tối đa 80 ký tự.");
        }

        return value;
    }
}
