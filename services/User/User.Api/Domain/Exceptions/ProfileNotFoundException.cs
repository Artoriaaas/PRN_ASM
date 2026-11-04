namespace User.Api.Domain.Exceptions;

public sealed class ProfileNotFoundException : Exception
{
    public ProfileNotFoundException() : base("Không tìm thấy hồ sơ người dùng.")
    {
    }
}
