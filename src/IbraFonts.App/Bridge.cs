using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;

namespace IbraFonts.App;

/// <summary>Messages from the page (web/native.js): {id, cmd, args} → {id, ok, result | error}.
/// Font files the page may read are served from https://fonts.ibra/&lt;token&gt;/ — only paths the app listed itself.</summary>
public sealed class Bridge
{
    private readonly MainWindow _window;
    private readonly CoreWebView2 _core;
    private readonly Dictionary<string, string> _allowed = new();
    private int _seq;

    public Bridge(MainWindow window, CoreWebView2 core)
    {
        _window = window;
        _core = core;
        core.WebMessageReceived += OnMessage;
        core.AddWebResourceRequestedFilter("https://fonts.ibra/*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += OnResource;
    }

    private string Allow(string path)
    {
        var token = "f" + (++_seq);
        _allowed[token] = path;
        return "https://fonts.ibra/" + token + "/" + Uri.EscapeDataString(Path.GetFileName(path));
    }

    private void OnResource(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        const string cors = "Access-Control-Allow-Origin: *";
        try
        {
            var token = new Uri(e.Request.Uri).AbsolutePath.Trim('/').Split('/')[0];
            if (!_allowed.TryGetValue(token, out var path) || !File.Exists(path))
            {
                e.Response = _core.Environment.CreateWebResourceResponse(null, 404, "Not Found", cors);
                return;
            }
            var bytes = File.ReadAllBytes(path);
            e.Response = _core.Environment.CreateWebResourceResponse(new MemoryStream(bytes), 200, "OK", "Content-Type: application/octet-stream\n" + cors);
        }
        catch (Exception ex)
        {
            Log.Write("read font: " + ex.Message);
            e.Response = _core.Environment.CreateWebResourceResponse(null, 500, "Error", cors);
        }
    }

    private async void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string? id = null;
        try
        {
            var msg = JsonNode.Parse(e.WebMessageAsJson)?.AsObject() ?? throw new InvalidOperationException("رسالة فارغة");
            id = msg["id"]?.GetValue<string>();
            var cmd = msg["cmd"]?.GetValue<string>() ?? "";
            var args = msg["args"] as JsonObject ?? new JsonObject();
            var result = await Handle(cmd, args);
            Reply(id, true, result, null);
        }
        catch (Exception ex)
        {
            Log.Write("bridge: " + ex.Message);
            Reply(id, false, null, ex.Message);
        }
    }

    private void Reply(string? id, bool ok, JsonNode? result, string? error)
    {
        if (id is null) return;
        var o = new JsonObject { ["id"] = id, ["ok"] = ok, ["result"] = result, ["error"] = error };
        _core.PostWebMessageAsJson(o.ToJsonString());
    }

    private static string Str(JsonObject a, string key, string fallback = "") =>
        a[key] is JsonValue v && v.TryGetValue<string>(out var s) ? s : fallback;

    private async Task<JsonNode?> Handle(string cmd, JsonObject a)
    {
        switch (cmd)
        {
            case "info":
                return new JsonObject { ["version"] = Program.Version, ["userFonts"] = Fonts.UserDir };

            case "listFonts":
            {
                var items = await Task.Run(() => Fonts.List());
                var arr = new JsonArray();
                foreach (var f in items)
                    arr.Add(new JsonObject
                    {
                        ["file"] = Path.GetFileName(f.Path), ["path"] = f.Path, ["scope"] = f.User ? "user" : "system",
                        ["size"] = f.Size, ["url"] = Allow(f.Path)
                    });
                return arr;
            }

            case "pendingFiles":
            {
                var arr = new JsonArray();
                foreach (var p in Program.OpenFiles) arr.Add(new JsonObject { ["file"] = Path.GetFileName(p), ["url"] = Allow(p) });
                Program.OpenFiles.Clear();
                return arr;
            }

            case "saveFile":
            {
                var name = Str(a, "name", "file");
                var bytes = Convert.FromBase64String(Str(a, "b64"));
                var dlg = new Microsoft.Win32.SaveFileDialog { FileName = name, InitialDirectory = Shell.Downloads, Filter = FilterFor(name) };
                if (dlg.ShowDialog(_window) != true) return null;
                await File.WriteAllBytesAsync(dlg.FileName, bytes);
                return JsonValue.Create(dlg.FileName);
            }

            case "installFont":
            {
                var replace = Str(a, "replace");
                var r = Fonts.Install(Str(a, "file", "font.ttf"), Convert.FromBase64String(Str(a, "b64")), Str(a, "family", "Font"),
                    string.IsNullOrEmpty(replace) ? null : replace);
                return new JsonObject { ["path"] = r.Path, ["note"] = r.Note };
            }

            case "pickFolder":
            {
                var dlg = new Microsoft.Win32.OpenFolderDialog
                {
                    Title = Str(a, "title", "اختار مجلد"),
                    InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory)
                };
                return dlg.ShowDialog(_window) == true ? JsonValue.Create(dlg.FolderName) : null;
            }

            case "copyFiles":
            {
                // Only font files the app itself listed may be copied.
                var allowed = new HashSet<string>(_allowed.Values, StringComparer.OrdinalIgnoreCase);
                var dest = Target(Str(a, "folder"), Str(a, "sub"));
                int count = 0;
                if (a["paths"] is JsonArray paths)
                    foreach (var node in paths)
                    {
                        var p = node?.GetValue<string>();
                        if (p is null || !allowed.Contains(p) || !File.Exists(p)) continue;
                        File.Copy(p, Unique(dest, Path.GetFileName(p)));
                        count++;
                    }
                Log.Write($"copied {count} fonts → {dest}");
                return new JsonObject { ["folder"] = dest, ["count"] = count };
            }

            case "writeFiles":
            {
                var dest = Target(Str(a, "folder"), Str(a, "sub"));
                int count = 0;
                if (a["files"] is JsonArray files)
                    foreach (var node in files)
                    {
                        if (node is not JsonObject f) continue;
                        var name = SafeFile(Str(f, "name", "font.ttf"));
                        await File.WriteAllBytesAsync(Unique(dest, name), Convert.FromBase64String(Str(f, "b64")));
                        count++;
                    }
                return new JsonObject { ["folder"] = dest, ["count"] = count };
            }

            case "openFolder":
            {
                var p = Str(a, "path");
                if (Directory.Exists(p)) Shell.Explorer("\"" + p + "\"");
                return null;
            }

            case "openFontsSettings":
                Shell.Open("ms-settings:fonts");
                return null;

            case "openFontsFolder":
                Shell.Explorer("shell:fonts");
                return null;

            case "reveal":
                Shell.Explorer("/select,\"" + Str(a, "path") + "\"");
                return null;

            case "clearAdobeCache":
            {
                var r = await Task.Run(() => AdobeCache.Clear());
                var running = new JsonArray();
                foreach (var n in r.Running) running.Add(n);
                return new JsonObject { ["deleted"] = r.Deleted, ["running"] = running };
            }

            case "checkUpdate":
            {
                var r = await Updater.LatestAsync();
                if (r is null) return null;
                return new JsonObject { ["current"] = Program.Version, ["latest"] = r.Version.ToString(), ["newer"] = r.Version > Updater.Current, ["size"] = r.Size };
            }

            case "installUpdate":
            {
                var r = await Updater.LatestAsync() ?? throw new InvalidOperationException("ما لكينا إصدار جديد");
                var setup = await Updater.DownloadAsync(r, CancellationToken.None);
                Updater.Install(setup);
                _window.Finish();
                return null;
            }

            case "selftest":
                if (Program.SelfTestOut != null)
                {
                    a["version"] = Program.Version;
                    File.WriteAllText(Program.SelfTestOut, a.ToJsonString());
                    _window.Finish();
                }
                return null;

            default:
                throw new InvalidOperationException("أمر غير معروف: " + cmd);
        }
    }

    private static string SafeFile(string name)
    {
        foreach (var c in Path.GetInvalidFileNameChars()) name = name.Replace(c, '-');
        return string.IsNullOrWhiteSpace(name) ? "file" : name.Trim();
    }

    /// <summary>The chosen folder, plus a tidy subfolder (e.g. "خطوط FS") when the page asks for one.</summary>
    private static string Target(string folder, string sub)
    {
        if (string.IsNullOrWhiteSpace(folder) || !Directory.Exists(folder)) throw new InvalidOperationException("المجلد غير موجود");
        var dest = string.IsNullOrWhiteSpace(sub) ? folder : Path.Combine(folder, SafeFile(sub));
        Directory.CreateDirectory(dest);
        return dest;
    }

    /// <summary>A file name in the folder that does not overwrite anything already there.</summary>
    private static string Unique(string folder, string name)
    {
        var path = Path.Combine(folder, name);
        var stem = Path.GetFileNameWithoutExtension(name);
        var ext = Path.GetExtension(name);
        for (int i = 2; File.Exists(path); i++) path = Path.Combine(folder, $"{stem}-{i}{ext}");
        return path;
    }

    private static string FilterFor(string name)
    {
        var ext = Path.GetExtension(name).ToLowerInvariant();
        var kind = ext switch
        {
            ".ttf" => "خط TrueType",
            ".otf" => "خط OpenType",
            ".zip" => "ملف مضغوط",
            ".json" => "مشروع خط",
            ".txt" => "ملف نصي",
            _ => "ملف"
        };
        return ext.Length > 0 ? $"{kind}|*{ext}|كل الملفات|*.*" : "كل الملفات|*.*";
    }
}
