using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace IbraFonts.App;

/// <summary>Windows fonts: lists installed font files and installs/replaces fonts for the current user
/// (no administrator rights — the same place Windows uses for "Install" in the font preview).</summary>
public static class Fonts
{
    private const string RegKey = @"Software\Microsoft\Windows NT\CurrentVersion\Fonts";
    private static readonly HashSet<string> Exts = new(StringComparer.OrdinalIgnoreCase) { ".ttf", ".otf", ".ttc", ".otc", ".pfb" };

    public static string SystemDir => Environment.GetFolderPath(Environment.SpecialFolder.Fonts);
    public static string UserDir => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Windows", "Fonts");

    public sealed record Item(string Path, bool User, long Size);
    public sealed record Result(string Path, string? Note);

    public static List<Item> List()
    {
        var list = new List<Item>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void Add(string p, bool user)
        {
            try
            {
                if (!Exts.Contains(Path.GetExtension(p)) || !File.Exists(p) || !seen.Add(Path.GetFullPath(p))) return;
                list.Add(new Item(Path.GetFullPath(p), user, new FileInfo(p).Length));
            }
            catch { /* unreadable entry */ }
        }

        if (Directory.Exists(SystemDir)) foreach (var f in Directory.EnumerateFiles(SystemDir)) Add(f, false);
        if (Directory.Exists(UserDir)) foreach (var f in Directory.EnumerateFiles(UserDir)) Add(f, true);

        // Fonts registered from other folders (some installers do that).
        foreach (var (root, user) in new[] { (Registry.LocalMachine, false), (Registry.CurrentUser, true) })
        {
            try
            {
                using var key = root.OpenSubKey(RegKey);
                if (key is null) continue;
                foreach (var name in key.GetValueNames())
                {
                    if (key.GetValue(name) is not string value) continue;
                    foreach (var part in value.Split('|', StringSplitOptions.RemoveEmptyEntries))
                        Add(Path.IsPathRooted(part) ? part : Path.Combine(SystemDir, part), user || part.StartsWith(UserDir, StringComparison.OrdinalIgnoreCase));
                }
            }
            catch (Exception e) { Log.Write("font registry: " + e.Message); }
        }
        return list.OrderBy(i => Path.GetFileName(i.Path), StringComparer.OrdinalIgnoreCase).ToList();
    }

    public static bool IsUserFont(string path) =>
        Path.GetFullPath(path).StartsWith(UserDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);

    public static Result Install(string file, byte[] data, string family, string? replace)
    {
        if (data.Length < 12) throw new InvalidOperationException("ملف الخط فاضي");
        Directory.CreateDirectory(UserDir);
        string? note = null;
        if (replace != null && File.Exists(replace) && IsUserFont(replace) && !Uninstall(replace))
            note = "النسخة القديمة مفتوحة ببرنامج ثاني، امسحها بعد ما تسكّره";

        file = SafeName(file);
        var target = Path.Combine(UserDir, file);
        if (File.Exists(target) && !TryRemove(target))
        {
            var stem = Path.GetFileNameWithoutExtension(file);
            var ext = Path.GetExtension(file);
            for (int i = 2; File.Exists(target); i++) target = Path.Combine(UserDir, $"{stem}-{i}{ext}");
        }
        File.WriteAllBytes(target, data);

        using (var key = Registry.CurrentUser.CreateSubKey(RegKey))
        {
            foreach (var name in key.GetValueNames())
            {
                if (key.GetValue(name) is string v &&
                    (v.Equals(target, StringComparison.OrdinalIgnoreCase) || name.StartsWith(family + " (", StringComparison.OrdinalIgnoreCase)))
                    key.DeleteValue(name, false);
            }
            var kind = Path.GetExtension(target).Equals(".otf", StringComparison.OrdinalIgnoreCase) ? "OpenType" : "TrueType";
            key.SetValue($"{family} ({kind})", target);
        }
        AddFontResource(target);
        Broadcast();
        Log.Write($"installed {family} → {target}");
        return new Result(target, note);
    }

    /// <summary>Removes a font installed for this user. False when the file is still open somewhere.</summary>
    public static bool Uninstall(string path)
    {
        using (var key = Registry.CurrentUser.OpenSubKey(RegKey, writable: true))
        {
            if (key != null)
                foreach (var name in key.GetValueNames())
                    if (key.GetValue(name) is string v &&
                        (v.Equals(path, StringComparison.OrdinalIgnoreCase) || v.Equals(Path.GetFileName(path), StringComparison.OrdinalIgnoreCase)))
                        key.DeleteValue(name, false);
        }
        var ok = TryRemove(path);
        Broadcast();
        return ok;
    }

    private static bool TryRemove(string path)
    {
        for (int i = 0; i < 4 && RemoveFontResource(path); i++) { }
        try { File.Delete(path); return true; }
        catch (Exception e) { Log.Write($"remove {path}: {e.Message}"); return false; }
    }

    private static string SafeName(string name)
    {
        foreach (var c in Path.GetInvalidFileNameChars()) name = name.Replace(c, '-');
        return string.IsNullOrWhiteSpace(name) ? "font.ttf" : name.Trim();
    }

    [DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
    private static extern int AddFontResource(string file);

    [DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
    private static extern bool RemoveFontResource(string file);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);

    private static void Broadcast() => PostMessage(new IntPtr(0xffff), 0x001D /* WM_FONTCHANGE */, IntPtr.Zero, IntPtr.Zero);
}
