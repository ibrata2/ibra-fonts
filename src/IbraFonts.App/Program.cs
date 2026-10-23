using System.Diagnostics;
using System.Windows;

namespace IbraFonts.App;

/// <summary>IBRA خطوط — من تصميم و تطوير و تعريب ابراهيم الخزرجي.
/// Command line: font files to open | --selftest out.json | --snapshot folder | --check-update out.txt</summary>
public static class Program
{
    public static string Version
    {
        get
        {
            var v = typeof(Program).Assembly.GetName().Version;
            return v is null ? "1.0.0" : $"{v.Major}.{v.Minor}.{Math.Max(0, v.Build)}";
        }
    }

    public static string DataDir { get; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "IBRA Fonts");
    public static string? SelfTestOut { get; private set; }
    public static string? SnapshotDir { get; private set; }
    public static List<string> OpenFiles { get; } = new();

    [STAThread]
    public static int Main(string[] args)
    {
        Directory.CreateDirectory(DataDir);
        string? updateOut = null;
        for (int i = 0; i < args.Length; i++)
        {
            var a = args[i];
            if (a == "--selftest" && i + 1 < args.Length) SelfTestOut = Path.GetFullPath(args[++i]);
            else if (a == "--snapshot" && i + 1 < args.Length) SnapshotDir = Path.GetFullPath(args[++i]);
            else if (a == "--check-update" && i + 1 < args.Length) updateOut = Path.GetFullPath(args[++i]);
            else if (File.Exists(a)) OpenFiles.Add(Path.GetFullPath(a));
        }

        if (updateOut != null)
        {
            try
            {
                var r = Updater.LatestAsync().GetAwaiter().GetResult();
                File.WriteAllText(updateOut, $"current={Version} latest={(r is null ? "none" : r.Version.ToString())}");
            }
            catch (Exception e) { File.WriteAllText(updateOut, $"current={Version} error={e.Message}"); }
            return 0;
        }

        AppDomain.CurrentDomain.UnhandledException += (_, e) => Log.Write("crash: " + e.ExceptionObject);
        var app = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
        app.DispatcherUnhandledException += (_, e) => { Log.Write("ui error: " + e.Exception); e.Handled = true; };
        Log.Write($"start {Version} files={OpenFiles.Count}");
        return app.Run(new MainWindow());
    }
}

public static class Log
{
    private static readonly object Gate = new();

    public static void Write(string message)
    {
        try
        {
            lock (Gate) File.AppendAllText(Path.Combine(Program.DataDir, "log.txt"), $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}{Environment.NewLine}");
        }
        catch { /* logging must never break the app */ }
    }
}

public static class Shell
{
    public static string Downloads => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");

    public static void Open(string target)
    {
        try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }
        catch (Exception e) { Log.Write("open: " + e.Message); }
    }

    public static void Explorer(string arguments)
    {
        try { Process.Start(new ProcessStartInfo("explorer.exe", arguments) { UseShellExecute = true }); }
        catch (Exception e) { Log.Write("explorer: " + e.Message); }
    }
}
