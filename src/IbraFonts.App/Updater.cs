using System.Diagnostics;
using System.Text.Json;

namespace IbraFonts.App;

/// <summary>Asks GitHub for the newest IBRA خطوط release, downloads its installer and installs it quietly
/// (the installer closes the app, replaces it and opens it again).</summary>
public static class Updater
{
    private const string Api = "https://api.github.com/repos/ibrata2/ibra-fonts/releases/latest";
    private static readonly HttpClient Client = new() { Timeout = TimeSpan.FromMinutes(10) };

    public sealed record Release(Version Version, string SetupUrl, long Size);

    public static Version Current => Parse(Program.Version);

    private static Version Parse(string s)
    {
        s = s.Trim().TrimStart('v', 'V');
        return System.Version.TryParse(s, out var v) ? new Version(v.Major, v.Minor, Math.Max(0, v.Build)) : new Version(0, 0, 0);
    }

    public static async Task<Release?> LatestAsync()
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, Api);
        req.Headers.TryAddWithoutValidation("User-Agent", "IBRA-Fonts/" + Program.Version);
        req.Headers.TryAddWithoutValidation("Accept", "application/vnd.github+json");
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        using var resp = await Client.SendAsync(req, cts.Token);
        if (!resp.IsSuccessStatusCode) throw new InvalidOperationException($"تعذر الوصول لصفحة التحديثات ({(int)resp.StatusCode})");
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(cts.Token));
        var root = doc.RootElement;
        var tag = root.GetProperty("tag_name").GetString() ?? "";
        foreach (var asset in root.GetProperty("assets").EnumerateArray())
        {
            var name = asset.GetProperty("name").GetString() ?? "";
            if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && name.Contains("Setup", StringComparison.OrdinalIgnoreCase))
                return new Release(Parse(tag), asset.GetProperty("browser_download_url").GetString() ?? "",
                    asset.TryGetProperty("size", out var size) ? size.GetInt64() : -1);
        }
        return null;
    }

    public static async Task<string> DownloadAsync(Release r, CancellationToken ct)
    {
        var file = Path.Combine(Path.GetTempPath(), $"IBRA-Fonts-Setup-{r.Version}.exe");
        using var req = new HttpRequestMessage(HttpMethod.Get, r.SetupUrl);
        req.Headers.TryAddWithoutValidation("User-Agent", "IBRA-Fonts/" + Program.Version);
        using var resp = await Client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        resp.EnsureSuccessStatusCode();
        await using (var fs = File.Create(file)) await resp.Content.CopyToAsync(fs, ct);
        return file;
    }

    public static void Install(string setup) =>
        Process.Start(new ProcessStartInfo(setup, "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART") { UseShellExecute = true });
}
