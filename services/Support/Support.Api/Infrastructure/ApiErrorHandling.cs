namespace Support.Api.Infrastructure;

using System.Diagnostics;
using Grpc.Core;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Support.Api.Domain.Exceptions;

public static class ApiErrorHandlingExtensions
{
    public static IServiceCollection AddApiErrorHandling(this IServiceCollection services)
    {
        services.AddProblemDetails();
        services.AddExceptionHandler<ApiExceptionHandler>();

        services.Configure<ApiBehaviorOptions>(options =>
        {
            options.InvalidModelStateResponseFactory = actionContext =>
            {
                var httpContext = actionContext.HttpContext;
                var traceId = GetTraceId(httpContext);
                var logger = httpContext.RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger("Support.Api.ModelValidation");

                logger.LogWarning(
                    "REST model validation failed for {Method} {Path}. TraceId: {TraceId}; ErrorCount: {ErrorCount}",
                    httpContext.Request.Method,
                    httpContext.Request.Path,
                    traceId,
                    actionContext.ModelState.ErrorCount);

                var problem = new ValidationProblemDetails(actionContext.ModelState)
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Dữ liệu yêu cầu không hợp lệ.",
                    Type = GetProblemType(StatusCodes.Status400BadRequest),
                    Instance = httpContext.Request.Path
                };
                problem.Extensions["code"] = "validation_error";
                problem.Extensions["traceId"] = traceId;

                var result = new BadRequestObjectResult(problem);
                result.ContentTypes.Add("application/problem+json");
                return result;
            };
        });

        return services;
    }

    public static IApplicationBuilder UseApiErrorHandling(this IApplicationBuilder app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages(async statusContext =>
        {
            var httpContext = statusContext.HttpContext;
            var descriptor = ApiErrorDescriptor.FromStatusCode(httpContext.Response.StatusCode);
            var traceId = GetTraceId(httpContext);

            var logger = httpContext.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("Support.Api.HttpStatus");

            logger.LogInformation(
                "REST request returned {StatusCode} for {Method} {Path}. TraceId: {TraceId}",
                descriptor.StatusCode,
                httpContext.Request.Method,
                httpContext.Request.Path,
                traceId);

            var problem = new ProblemDetails
            {
                Status = descriptor.StatusCode,
                Title = descriptor.Title,
                Detail = descriptor.Detail,
                Type = GetProblemType(descriptor.StatusCode),
                Instance = httpContext.Request.Path
            };
            problem.Extensions["code"] = descriptor.Code;
            problem.Extensions["traceId"] = traceId;

            var problemDetailsService = httpContext.RequestServices
                .GetRequiredService<IProblemDetailsService>();

            await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = httpContext,
                ProblemDetails = problem
            });
        });

        return app;
    }

    internal static string GetTraceId(HttpContext httpContext) =>
        Activity.Current?.Id ?? httpContext.TraceIdentifier;

    internal static string GetProblemType(int statusCode) =>
        $"https://httpstatuses.com/{statusCode}";
}

public sealed class ApiExceptionHandler(
    ILogger<ApiExceptionHandler> logger,
    IProblemDetailsService problemDetailsService,
    IHostEnvironment environment) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            logger.LogInformation(
                "REST request was cancelled by the client for {Method} {Path}. TraceId: {TraceId}",
                httpContext.Request.Method,
                httpContext.Request.Path,
                ApiErrorHandlingExtensions.GetTraceId(httpContext));
            return true;
        }

        var descriptor = ApiErrorDescriptor.FromException(exception);
        var traceId = ApiErrorHandlingExtensions.GetTraceId(httpContext);

        if (descriptor.StatusCode >= StatusCodes.Status500InternalServerError)
        {
            logger.LogError(
                exception,
                "Unhandled REST exception returned {StatusCode} for {Method} {Path}. TraceId: {TraceId}",
                descriptor.StatusCode,
                httpContext.Request.Method,
                httpContext.Request.Path,
                traceId);
        }
        else
        {
            logger.LogWarning(
                exception,
                "Handled REST exception returned {StatusCode} for {Method} {Path}. TraceId: {TraceId}",
                descriptor.StatusCode,
                httpContext.Request.Method,
                httpContext.Request.Path,
                traceId);
        }

        httpContext.Response.StatusCode = descriptor.StatusCode;

        var problem = new ProblemDetails
        {
            Status = descriptor.StatusCode,
            Title = descriptor.Title,
            Detail = descriptor.ExposeExceptionMessage || environment.IsDevelopment()
                ? exception.Message
                : descriptor.Detail,
            Type = ApiErrorHandlingExtensions.GetProblemType(descriptor.StatusCode),
            Instance = httpContext.Request.Path
        };
        problem.Extensions["code"] = descriptor.Code;
        problem.Extensions["traceId"] = traceId;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception
        });
    }
}

internal sealed record ApiErrorDescriptor(
    int StatusCode,
    string Code,
    string Title,
    string Detail,
    bool ExposeExceptionMessage)
{
    public static ApiErrorDescriptor FromException(Exception exception) => exception switch
    {
        NotFoundException or KeyNotFoundException => Create(
            StatusCodes.Status404NotFound,
            "resource_not_found",
            "Không tìm thấy tài nguyên.",
            exposeExceptionMessage: true),

        ValidationException or ArgumentException => Create(
            StatusCodes.Status400BadRequest,
            "validation_error",
            "Dữ liệu yêu cầu không hợp lệ.",
            exposeExceptionMessage: true),

        UnauthorizedAccessException => Create(
            StatusCodes.Status403Forbidden,
            "forbidden",
            "Bạn không có quyền thực hiện thao tác này.",
            exposeExceptionMessage: true),

        InvalidOperationException => Create(
            StatusCodes.Status409Conflict,
            "invalid_state",
            "Trạng thái hiện tại không cho phép thực hiện thao tác.",
            exposeExceptionMessage: true),

        DbUpdateConcurrencyException => Create(
            StatusCodes.Status409Conflict,
            "concurrency_conflict",
            "Dữ liệu đã được thay đổi bởi một yêu cầu khác. Vui lòng tải lại và thử lại."),

        DbUpdateException => Create(
            StatusCodes.Status409Conflict,
            "database_conflict",
            "Không thể lưu dữ liệu do xung đột ràng buộc."),

        TimeoutException => Create(
            StatusCodes.Status504GatewayTimeout,
            "request_timeout",
            "Yêu cầu xử lý quá thời gian cho phép."),

        RpcException rpcException => FromRpcException(rpcException),

        _ => Create(
            StatusCodes.Status500InternalServerError,
            "internal_server_error",
            "Máy chủ gặp lỗi ngoài dự kiến. Vui lòng thử lại sau.")
    };

    public static ApiErrorDescriptor FromStatusCode(int statusCode) => statusCode switch
    {
        StatusCodes.Status400BadRequest => Create(statusCode, "bad_request", "Yêu cầu không hợp lệ."),
        StatusCodes.Status401Unauthorized => Create(statusCode, "unauthenticated", "Cần đăng nhập bằng token hợp lệ."),
        StatusCodes.Status403Forbidden => Create(statusCode, "forbidden", "Bạn không có quyền truy cập tài nguyên này."),
        StatusCodes.Status404NotFound => Create(statusCode, "endpoint_not_found", "Không tìm thấy API được yêu cầu."),
        StatusCodes.Status405MethodNotAllowed => Create(statusCode, "method_not_allowed", "HTTP method không được hỗ trợ cho API này."),
        StatusCodes.Status415UnsupportedMediaType => Create(statusCode, "unsupported_media_type", "Content-Type của yêu cầu không được hỗ trợ."),
        StatusCodes.Status429TooManyRequests => Create(statusCode, "too_many_requests", "Có quá nhiều yêu cầu. Vui lòng thử lại sau."),
        _ when statusCode >= StatusCodes.Status500InternalServerError => Create(
            statusCode,
            "server_error",
            "Máy chủ không thể hoàn thành yêu cầu."),
        _ => Create(statusCode, "request_failed", "Không thể hoàn thành yêu cầu.")
    };

    private static ApiErrorDescriptor FromRpcException(RpcException exception)
    {
        var statusCode = exception.StatusCode switch
        {
            Grpc.Core.StatusCode.InvalidArgument => StatusCodes.Status400BadRequest,
            Grpc.Core.StatusCode.Unauthenticated => StatusCodes.Status401Unauthorized,
            Grpc.Core.StatusCode.PermissionDenied => StatusCodes.Status403Forbidden,
            Grpc.Core.StatusCode.NotFound => StatusCodes.Status404NotFound,
            Grpc.Core.StatusCode.AlreadyExists => StatusCodes.Status409Conflict,
            Grpc.Core.StatusCode.FailedPrecondition => StatusCodes.Status409Conflict,
            Grpc.Core.StatusCode.ResourceExhausted => StatusCodes.Status429TooManyRequests,
            Grpc.Core.StatusCode.DeadlineExceeded => StatusCodes.Status504GatewayTimeout,
            Grpc.Core.StatusCode.Unavailable => StatusCodes.Status503ServiceUnavailable,
            _ => StatusCodes.Status502BadGateway
        };

        var exposeDetail = statusCode < StatusCodes.Status500InternalServerError;
        return new ApiErrorDescriptor(
            statusCode,
            "upstream_rpc_error",
            "Dịch vụ phụ thuộc không thể hoàn thành yêu cầu.",
            exposeDetail ? exception.Status.Detail : "Dịch vụ phụ thuộc tạm thời không khả dụng.",
            exposeDetail);
    }

    private static ApiErrorDescriptor Create(
        int statusCode,
        string code,
        string detail,
        bool exposeExceptionMessage = false) => new(
            statusCode,
            code,
            GetTitle(statusCode),
            detail,
            exposeExceptionMessage);

    private static string GetTitle(int statusCode) => statusCode switch
    {
        StatusCodes.Status400BadRequest => "Bad Request",
        StatusCodes.Status401Unauthorized => "Unauthorized",
        StatusCodes.Status403Forbidden => "Forbidden",
        StatusCodes.Status404NotFound => "Not Found",
        StatusCodes.Status405MethodNotAllowed => "Method Not Allowed",
        StatusCodes.Status409Conflict => "Conflict",
        StatusCodes.Status415UnsupportedMediaType => "Unsupported Media Type",
        StatusCodes.Status429TooManyRequests => "Too Many Requests",
        StatusCodes.Status502BadGateway => "Bad Gateway",
        StatusCodes.Status503ServiceUnavailable => "Service Unavailable",
        StatusCodes.Status504GatewayTimeout => "Gateway Timeout",
        _ => "Internal Server Error"
    };
}
