namespace SeniorCard.Api;

// Row in venues(id TEXT PK, name, category, address, lat, lng,
// discount_info, points_deducted, main_category). Read-only.
public sealed record Venue(
    string Id,
    string Name,
    string Category,
    string Address,
    double Lat,
    double Lng,
    string DiscountInfo,
    int Points,
    string MainCategory,
    string? NamePhonemes = null,
    string? DiscountPhonemes = null
);

public sealed record PlaceItem(
    string Id,
    string Name,
    string SubCategory,
    string Address,
    double Lat,
    double Lng,
    int Points,
    string DiscountInfo,
    double? DistanceMeters,
    string? NamePhonemes = null
);

public sealed record PlacesResponse(int RadiusMeters, IReadOnlyList<PlaceItem> Items);

public sealed record PlaceDetail(
    string Id,
    string Name,
    string SubCategory,
    string Address,
    double Lat,
    double Lng,
    int Points,
    string DiscountInfo,
    double? DistanceMeters,
    IReadOnlyList<string> Benefits,
    string? NamePhonemes = null,
    IReadOnlyList<string>? BenefitsPhonemes = null
);
