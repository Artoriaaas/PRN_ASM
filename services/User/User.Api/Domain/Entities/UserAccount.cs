namespace User.Api.Domain.Entities;

public sealed class UserAccount
{
    public Guid Id { get; set; }
    public string FirebaseUid { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string Role { get; set; } = "user";
    public string Status { get; set; } = "active";
    public int TotalGames { get; set; }
    public int Wins { get; set; }
    public int TotalExp { get; set; }
    public int PlayerLevel { get; set; } = 1;
    public int Trophies { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
