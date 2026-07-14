FROM node:20-bookworm-slim AS ui-build
WORKDIR /ui
COPY cpq-import-ui/package*.json ./
RUN npm ci
COPY cpq-import-ui/ ./
RUN npm run build:prod

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["src/CPQ_Import_App.API/CPQ_Import_App.API.csproj", "src/CPQ_Import_App.API/"]
COPY ["src/CPQ_Import_App.Core/CPQ_Import_App.Core.csproj", "src/CPQ_Import_App.Core/"]
COPY ["src/CPQ_Import_App.Infrastructure/CPQ_Import_App.Infrastructure.csproj", "src/CPQ_Import_App.Infrastructure/"]
RUN dotnet restore "src/CPQ_Import_App.API/CPQ_Import_App.API.csproj"
COPY . .

COPY --from=ui-build /ui/dist/cpq-import-ui/browser/ ./src/CPQ_Import_App.API/wwwroot/

WORKDIR "/src/src/CPQ_Import_App.API"
RUN dotnet publish "CPQ_Import_App.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "CPQ_Import_App.API.dll"]
