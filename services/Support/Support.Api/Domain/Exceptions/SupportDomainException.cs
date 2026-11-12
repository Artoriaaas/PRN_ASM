namespace Support.Api.Domain.Exceptions;

using System;

public abstract class SupportDomainException : Exception
{
    protected SupportDomainException(string message) : base(message) { }
}

public sealed class NotFoundException : SupportDomainException
{
    public NotFoundException(string message) : base(message) { }
}

public sealed class ValidationException : SupportDomainException
{
    public ValidationException(string message) : base(message) { }
}
