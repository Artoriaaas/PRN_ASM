namespace Multiplayer.Api.Grpc;

using System;
using System.Threading.Tasks;
using global::Grpc.Core;
using global::Grpc.Core.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Multiplayer.Api.Domain.Exceptions;

public sealed class DomainExceptionInterceptor : Interceptor
{
    private readonly ILogger<DomainExceptionInterceptor> _logger;

    public DomainExceptionInterceptor(ILogger<DomainExceptionInterceptor> logger)
    {
        _logger = logger;
    }

    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        try
        {
            return await continuation(request, context);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning(ex, "Validation failure on gRPC method {Method}", context.Method);
            throw new RpcException(new Status(StatusCode.InvalidArgument, ex.Message));
        }
        catch (NotFoundException ex)
        {
            _logger.LogWarning(ex, "Resource not found on gRPC method {Method}", context.Method);
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
        catch (InvalidStateException ex)
        {
            _logger.LogWarning(ex, "Invalid state transition on gRPC method {Method}", context.Method);
            throw new RpcException(new Status(StatusCode.FailedPrecondition, ex.Message));
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogError(ex, "Concurrency conflict on gRPC method {Method}", context.Method);
            throw new RpcException(new Status(StatusCode.Aborted, "A concurrent update occurred. Please retry."));
        }
        catch (RpcException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled server error on gRPC method {Method}", context.Method);
            throw new RpcException(new Status(StatusCode.Internal, "An internal server error occurred."));
        }
    }
}
