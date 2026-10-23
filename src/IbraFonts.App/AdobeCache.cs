using System.Diagnostics;

namespace IbraFonts.App;

/// <summary>Photoshop and Illustrator keep their own font lists; a stale list shows old or broken fonts.
/// Deleting it is safe — Adobe rebuilds it on the next start. Refuses while an Adobe app is open.</summary>
public static class AdobeCache
{
    public sealed record Result(int Deleted, List<string> Running);

    private static readonly (string Process, string Name)[] Apps =
    {
        ("Photoshop", "Photoshop"), ("Illustrator", "Illustrator"), ("InDesign", "InDesign"),
        ("AfterFX", "After Effects"), ("Adobe Premiere Pro", "Premiere Pro")
    };

    public static Result Clear()
    {
        var running = new List<string>();
        foreach (var (proc, name) in Apps)
        {
            var found = Process.GetProcessesByName(proc);
            if (found.Length > 0) running.Add(name);
            foreach (var p in found) p.Dispose();
        }
        if (running.Count > 0) return new Result(0, running);

        int deleted = 0;
        var roaming = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Adobe");
        var local = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Adobe");

        if (Directory.Exists(roaming))
        {
            foreach (var dir in Directory.EnumerateDirectories(roaming, "Adobe Photoshop*"))
            {
                var cache = Path.Combine(dir, "CT Font Cache");
                if (!Directory.Exists(cache)) continue;
                try { Directory.Delete(cache, recursive: true); deleted++; }
                catch (Exception e) { Log.Write("font cache: " + e.Message); }
            }
        }

        var options = new EnumerationOptions { RecurseSubdirectories = true, IgnoreInaccessible = true, MaxRecursionDepth = 6 };
        foreach (var root in new[] { roaming, local })
        {
            if (!Directory.Exists(root)) continue;
            foreach (var f in Directory.EnumerateFiles(root, "AdobeFnt*.lst", options))
            {
                try { File.Delete(f); deleted++; }
                catch (Exception e) { Log.Write("font list: " + e.Message); }
            }
        }
        Log.Write($"adobe cache cleared: {deleted}");
        return new Result(deleted, running);
    }
}
