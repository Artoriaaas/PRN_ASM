FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY proto/ proto/
COPY building-block/ building-block/
COPY services/User/ services/User/
RUN dotnet publish services/User/User.Api/User.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "User.Api.dll"]
