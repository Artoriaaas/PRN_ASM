namespace Game.Api.Domain.Exceptions;

using System;

public abstract class GameDomainException : Exception
{
    protected GameDomainException(string message) : base(message) { }
    protected GameDomainException(string message, Exception innerException) : base(message, innerException) { }
}

public class ValidationException : GameDomainException
{
    public ValidationException(string message) : base(message) { }
}

public class NotFoundException : GameDomainException
{
    public NotFoundException(string message) : base(message) { }
}

public class InvalidStateException : GameDomainException
{
    public InvalidStateException(string message) : base(message) { }
}
