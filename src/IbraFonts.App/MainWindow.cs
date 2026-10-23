using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace IbraFonts.App;

/// <summary>One window: the IBRA خطوط page (web/) served from https://app.ibra/ inside WebView2.</summary>
public sealed class MainWindow : Window
{
    private readonly WebView2 _web = new();
    private Bridge? _bridge;
    private bool _loadedOnce;

    public MainWindow()
    {
        Title = "IBRA خطوط";
        Width = 1320;
        Height = 900;
        MinWidth = 880;
        MinHeight = 620;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Background = new SolidColorBrush(Color.FromRgb(13, 12, 10));
        try { Icon = new BitmapImage(new Uri("pack://application:,,,/Assets/ibra-fonts.ico")); } catch { /* the exe icon still shows */ }
        _web.DefaultBackgroundColor = System.Drawing.Color.FromArgb(13, 12, 10);
        Content = _web;
        SourceInitialized += (_, _) => DarkTitleBar();
        Loaded += async (_, _) => await Start();
    }

    public void Finish() => Dispatcher.BeginInvoke(new Action(Close));

    private async Task Start()
    {
        try
        {
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Program.DataDir, "WebView2"));
            await _web.EnsureCoreWebView2Async(env);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(this,
                "البرنامج يحتاج «Microsoft Edge WebView2 Runtime» وهو غير موجود بهذا الجهاز.\nراح نفتح صفحة التحميل من مايكروسوفت، نصّبه وافتح البرنامج من جديد.",
                "IBRA خطوط", MessageBoxButton.OK, MessageBoxImage.Warning);
            Shell.Open("https://developer.microsoft.com/microsoft-edge/webview2/");
            Close();
            return;
        }
        catch (Exception e)
        {
            Log.Write("webview: " + e);
            MessageBox.Show(this, "تعذر تشغيل واجهة البرنامج:\n" + e.Message, "IBRA خطوط", MessageBoxButton.OK, MessageBoxImage.Error);
            Close();
            return;
        }

        var core = _web.CoreWebView2;
        var webDir = Path.Combine(AppContext.BaseDirectory, "web");
        core.SetVirtualHostNameToFolderMapping("app.ibra", webDir, CoreWebView2HostResourceAccessKind.Allow);
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.AreDevToolsEnabled = Environment.GetEnvironmentVariable("IBRA_DEVTOOLS") == "1";
        core.Settings.IsZoomControlEnabled = true;
        _bridge = new Bridge(this, core);

        // Links to other sites open in the normal browser.
        core.NewWindowRequested += (_, e) => { e.Handled = true; Shell.Open(e.Uri); };
        core.NavigationStarting += (_, e) =>
        {
            if (!e.Uri.StartsWith("https://app.ibra/", StringComparison.OrdinalIgnoreCase)) { e.Cancel = true; Shell.Open(e.Uri); }
        };
        core.DownloadStarting += OnDownload;
        core.NavigationCompleted += async (_, e) =>
        {
            if (!e.IsSuccess) Log.Write("navigation failed: " + e.WebErrorStatus);
            if (_loadedOnce) return;
            _loadedOnce = true;
            await AfterLoad();
        };
        core.Navigate("https://app.ibra/index.html" + (Program.SelfTestOut != null ? "?selftest=1" : ""));
    }

    /// <summary>CI helpers: --snapshot saves PNGs of both tabs; --selftest gives up after 40 s if the page never answers.</summary>
    private async Task AfterLoad()
    {
        if (Program.SnapshotDir != null)
        {
            Directory.CreateDirectory(Program.SnapshotDir);
            await Task.Delay(3500);
            await Capture(Path.Combine(Program.SnapshotDir, "doctor.png"));
            await _web.CoreWebView2.ExecuteScriptAsync("document.getElementById('tab-ed').click()");
            await Task.Delay(2000);
            await Capture(Path.Combine(Program.SnapshotDir, "editor.png"));
            await _web.CoreWebView2.ExecuteScriptAsync("document.getElementById('tab-doc').click()");
            Close();
            return;
        }
        if (Program.SelfTestOut != null)
        {
            await Task.Delay(40000);
            if (!File.Exists(Program.SelfTestOut)) File.WriteAllText(Program.SelfTestOut, "{\"error\":\"timeout\"}");
            Close();
        }
    }

    private async Task Capture(string file)
    {
        try
        {
            await using var fs = File.Create(file);
            await _web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, fs);
        }
        catch (Exception e) { Log.Write("snapshot: " + e.Message); }
    }

    /// <summary>Plain browser downloads (blob links) get a normal Save dialog.</summary>
    private void OnDownload(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        var deferral = e.GetDeferral();
        Dispatcher.BeginInvoke(new Action(() =>
        {
            try
            {
                var dlg = new Microsoft.Win32.SaveFileDialog
                {
                    FileName = Path.GetFileName(e.ResultFilePath),
                    InitialDirectory = Shell.Downloads,
                    Filter = "كل الملفات|*.*"
                };
                if (dlg.ShowDialog(this) == true) { e.ResultFilePath = dlg.FileName; e.Handled = true; }
                else e.Cancel = true;
            }
            catch (Exception ex) { Log.Write("download: " + ex.Message); }
            finally { deferral.Complete(); }
        }));
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

    private void DarkTitleBar()
    {
        try
        {
            var handle = new WindowInteropHelper(this).Handle;
            int on = 1;
            DwmSetWindowAttribute(handle, 20, ref on, sizeof(int)); // DWMWA_USE_IMMERSIVE_DARK_MODE
        }
        catch { /* older Windows keeps the light title bar */ }
    }
}
