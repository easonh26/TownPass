using Microsoft.Data.Sqlite;

namespace SeniorCard.Api;

public static class Categories
{
    public static readonly string[] All = ["交通", "娛樂", "運動", "醫療"];

    // "交通-公車" -> "公車"；其餘維持原名（游泳池、聯合醫院院區…）。
    public static string SubCategory(string main, string category) =>
        main == "交通" && category.StartsWith("交通-", StringComparison.Ordinal)
            ? category["交通-".Length..]
            : category;
}

public static class Geo
{
    private const double EarthMeters = 6_371_000.0;

    public static double HaversineMeters(double lat1, double lng1, double lat2, double lng2)
    {
        static double Rad(double d) => d * Math.PI / 180.0;
        var dLat = Rad(lat2 - lat1);
        var dLng = Rad(lng2 - lng1);
        var a =
            Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
            Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) *
            Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return 2 * EarthMeters * Math.Asin(Math.Sqrt(a));
    }
}

public sealed class VenuesRepository
{
    private readonly string _connectionString;

    public VenuesRepository(string dbPath)
    {
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = dbPath,
            Mode = SqliteOpenMode.ReadOnly,
            Cache = SqliteCacheMode.Shared,
        }.ToString();
    }

    public bool CanConnect()
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM venues";
            return Convert.ToInt64(cmd.ExecuteScalar()) > 0;
        }
        catch
        {
            return false;
        }
    }

    private static void AddBBox(SqliteCommand cmd, double lat, double lng, int radiusMeters)
    {
        // ~111.32km per degree latitude; longitude scaled by cos(latitude).
        var dLat = radiusMeters / 111_320.0;
        var dLng = radiusMeters / (111_320.0 * Math.Max(0.2, Math.Cos(lat * Math.PI / 180.0)));
        cmd.Parameters.AddWithValue("$latMin", lat - dLat);
        cmd.Parameters.AddWithValue("$latMax", lat + dLat);
        cmd.Parameters.AddWithValue("$lngMin", lng - dLng);
        cmd.Parameters.AddWithValue("$lngMax", lng + dLng);
    }

    private static Venue ReadVenue(SqliteDataReader r) => new(
        r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3),
        r.GetDouble(4), r.GetDouble(5), r.GetString(6),
        r.GetInt32(7), r.GetString(8));

    private const string Columns =
        "id, name, category, address, lat, lng, discount_info, points_deducted, main_category";

    public List<Venue> QueryBox(string category, double lat, double lng, int radiusMeters)
    {
        using var conn = new SqliteConnection(_connectionString);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            $"SELECT {Columns} FROM venues WHERE main_category = $cat " +
            "AND lat BETWEEN $latMin AND $latMax AND lng BETWEEN $lngMin AND $lngMax";
        cmd.Parameters.AddWithValue("$cat", category);
        AddBBox(cmd, lat, lng, radiusMeters);
        using var reader = cmd.ExecuteReader();
        var list = new List<Venue>();
        while (reader.Read()) list.Add(ReadVenue(reader));
        return list;
    }

    public Venue? GetById(string id)
    {
        using var conn = new SqliteConnection(_connectionString);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT {Columns} FROM venues WHERE id = $id LIMIT 1";
        cmd.Parameters.AddWithValue("$id", id);
        using var reader = cmd.ExecuteReader();
        return reader.Read() ? ReadVenue(reader) : null;
    }

    // Nearest-first search with expanding radius, then merge same-name
    // venues within MergeMeters (bus stops share names across stops).
    public (int RadiusMeters, List<(Venue Venue, double Distance)>) SearchNearest(
        string category, double lat, double lng, int limit)
    {
        int[] steps = [500, 1000, 2000, 5000, 10000];
        List<Venue> candidates = [];
        var used = steps[^1];
        foreach (var r in steps)
        {
            used = r;
            candidates = QueryBox(category, lat, lng, r);
            if (candidates.Count >= limit * 3) break;
        }

        var ranked = candidates
            .Select(v => (Venue: v, Distance: Geo.HaversineMeters(lat, lng, v.Lat, v.Lng)))
            .OrderBy(x => x.Distance)
            .ToList();

        const double MergeMeters = 300.0;
        var merged = new List<(Venue, double)>();
        foreach (var item in ranked)
        {
            var dup = merged.FindIndex(m =>
                m.Item1.Name == item.Venue.Name && Math.Abs(m.Item2 - item.Distance) < MergeMeters);
            if (dup < 0) merged.Add(item);
            if (merged.Count >= limit) break;
        }
        return (used, merged);
    }

    public static List<string> SplitBenefits(string discountInfo) =>
        discountInfo
            .Split('。', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => s + '。')
            .ToList();
}
