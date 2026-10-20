namespace Sudoku.Observability;

using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

public static class ObservabilityExtensions
{
    public static WebApplicationBuilder AddSudokuObservability(this WebApplicationBuilder builder, string serviceName)
    {
        var otelEndpoint = builder.Configuration["Otel:Endpoint"];

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(serviceName))
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation()
                    .AddGrpcClientInstrumentation();

                if (!string.IsNullOrWhiteSpace(otelEndpoint))
                {
                    tracing.AddOtlpExporter(opt =>
                    {
                        opt.Endpoint = new Uri(otelEndpoint);
                    });
                }
            })
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation();

                if (!string.IsNullOrWhiteSpace(otelEndpoint))
                {
                    metrics.AddOtlpExporter(opt =>
                    {
                        opt.Endpoint = new Uri(otelEndpoint);
                    });
                }
            });

        return builder;
    }
}
