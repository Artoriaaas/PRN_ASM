FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY proto/ proto/
COPY building-block/ building-block/
COPY services/Multiplayer/ services/Multiplayer/
RUN dotnet publish services/Multiplayer/Multiplayer.Api/Multiplayer.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "Multiplayer.Api.dll"]
