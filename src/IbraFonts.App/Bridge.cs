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
