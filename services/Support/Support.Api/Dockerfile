FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY proto/ proto/
COPY building-block/ building-block/
COPY services/Support/ services/Support/
RUN dotnet publish services/Support/Support.Api/Support.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "Support.Api.dll"]
