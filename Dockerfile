FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["src/CPQ_Import_App.API/CPQ_Import_App.API.csproj", "src/CPQ_Import_App.API/"]
COPY ["src/CPQ_Import_App.Core/CPQ_Import_App.Core.csproj", "src/CPQ_Import_App.Core/"]
COPY ["src/CPQ_Import_App.Infrastructure/CPQ_Import_App.Infrastructure.csproj", "src/CPQ_Import_App.Infrastructure/"]
RUN dotnet restore "src/CPQ_Import_App.API/CPQ_Import_App.API.csproj"
COPY . .
WORKDIR "/src/src/CPQ_Import_App.API"
RUN dotnet build "CPQ_Import_App.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CPQ_Import_App.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "CPQ_Import_App.API.dll"]
