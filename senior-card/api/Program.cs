using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using SeniorCard.Api;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("public", o =>
    {
        o.PermitLimit = 120;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

var app = builder.Build();

// Behind nginx (docker network), so trust its forwarded headers.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
});
app.UseRateLimiter();

var dbPath = app.Configuration["VENUES_DB_PATH"]
    ?? Path.Combine(AppContext.BaseDirectory, "data", "venues.db");
var venues = new VenuesRepository(dbPath);
app.Logger.LogInformation("Using venues DB at {DbPath}", dbPath);

var taigiDbPath = app.Configuration["TAIGI_DB_PATH"]
    ?? Path.Combine(AppContext.BaseDirectory, "data", "venues_taigi.db");
VenuesRepository? taigi = File.Exists(taigiDbPath)
    ? new VenuesRepository(taigiDbPath, includePhonemes: true)
    : null;
app.Logger.LogInformation("Taigi venues DB at {DbPath}: {Status}", taigiDbPath, taigi is null ? "missing" : "ok");

app.MapGet("/api/health", () =>
    venues.CanConnect()
        ? Results.Ok(new { status = "ok", time = DateTimeOffset.UtcNow, taigi = taigi?.CanConnect() ?? false })
        : Results.Problem("venues database unavailable", statusCode: 503));

app.MapGet("/api/v1/places", (string? category, double? lat, double? lng, int? limit, string? subcategory, string? lang) =>
{
    if (string.IsNullOrWhiteSpace(category) || !Categories.All.Contains(category))
        return Results.Problem("category must be one of 交通/娛樂/運動/醫療", statusCode: 400);
    if (lat is null or < -90 or > 90 || lng is null or < -180 or > 180)
        return Results.Problem("lat/lng out of range", statusCode: 400);
    var take = Math.Clamp(limit ?? 20, 1, 50);

    string[]? subs = null;
    if (!string.IsNullOrWhiteSpace(subcategory))
    {
        if (category != "交通" || !Categories.TransportMap.TryGetValue(subcategory, out var mapped))
            return Results.Problem("subcategory must be one of 公車/捷運/臺鐵/貓空纜車 (交通 only)", statusCode: 400);
        subs = mapped;
    }

    var repo = venues;
    if (lang == "taigi")
    {
        if (taigi is null)
            return Results.Problem("taigi database unavailable", statusCode: 503);
        repo = taigi;
    }
    else if (!string.IsNullOrWhiteSpace(lang))
    {
        return Results.Problem("lang must be taigi or omitted", statusCode: 400);
    }

    var (radius, found) = repo.SearchNearest(category!, lat.Value, lng.Value, take, subs);
    var items = found.Select(x => new PlaceItem(
        x.Venue.Id, x.Venue.Name,
        Categories.SubCategory(x.Venue.MainCategory, x.Venue.Category),
        x.Venue.Address, x.Venue.Lat, x.Venue.Lng,
        x.Venue.Points, x.Venue.DiscountInfo,
        Math.Round(x.Distance),
        x.Venue.NamePhonemes)).ToList();

    return Results.Ok(new PlacesResponse(radius, items));
}).RequireRateLimiting("public");

app.MapGet("/api/v1/places/{id}", (string id, double? lat, double? lng, string? lang) =>
{
    var repo = venues;
    if (lang == "taigi")
    {
        if (taigi is null)
            return Results.Problem("taigi database unavailable", statusCode: 503);
        repo = taigi;
    }
    else if (!string.IsNullOrWhiteSpace(lang))
    {
        return Results.Problem("lang must be taigi or omitted", statusCode: 400);
    }
    var v = repo.GetById(id);
    if (v is null) return Results.NotFound();
    double? dist = lat is >= -90 and <= 90 && lng is >= -180 and <= 180
        ? Math.Round(Geo.HaversineMeters(lat.Value, lng.Value, v.Lat, v.Lng))
        : null;
    return Results.Ok(new PlaceDetail(
        v.Id, v.Name, Categories.SubCategory(v.MainCategory, v.Category),
        v.Address, v.Lat, v.Lng, v.Points, v.DiscountInfo, dist,
        VenuesRepository.SplitBenefits(v.DiscountInfo),
        v.NamePhonemes, VenuesRepository.SplitPhonemeBenefits(v.DiscountPhonemes)));
}).RequireRateLimiting("public");

app.Run();
