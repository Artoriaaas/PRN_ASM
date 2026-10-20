FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY proto/ proto/
COPY building-block/ building-block/
COPY services/Game/ services/Game/
RUN dotnet publish services/Game/Game.Api/Game.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "Game.Api.dll"]
