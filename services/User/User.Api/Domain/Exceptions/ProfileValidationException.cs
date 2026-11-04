namespace User.Api.Domain.Exceptions;

public sealed class ProfileValidationException(string message) : Exception(message);
