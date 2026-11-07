# ASP.NET Core 10 API (read-only venues DB baked into the image).
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY SeniorCard.Api.csproj ./
RUN dotnet restore
COPY . ./
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data \
  && chown -R app:app /app
COPY --from=build /app/publish ./
# venues.db is counselled read-only; copied with app ownership so the
# non-root `app` user can open it. The file itself is never modified.
COPY data/venues.db /app/data/venues.db
RUN chown app:app /app/data/venues.db
USER app
ENV ASPNETCORE_URLS=http://+:8080 \
    VENUES_DB_PATH=/app/data/venues.db
EXPOSE 8080
ENTRYPOINT ["dotnet", "SeniorCard.Api.dll"]
