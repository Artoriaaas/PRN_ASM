namespace User.Api.Domain.Services;

using User.Api.Domain.Entities;

public interface IUserProfileService
{
    Task<(UserAccount Profile, bool IsNewUser)> GetOrCreateAsync(
        string firebaseUid,
        string email,
        string displayName,
        string avatarUrl,
        CancellationToken cancellationToken);

    Task<UserAccount> GetAsync(string firebaseUid, CancellationToken cancellationToken);

    Task<IReadOnlyList<UserAccount>> GetProfilesAsync(
        IReadOnlyList<string> firebaseUids,
        CancellationToken cancellationToken);

    Task<UserAccount> UpdateAsync(
        string firebaseUid,
        string displayName,
        string avatarUrl,
        string country,
        CancellationToken cancellationToken);
}
