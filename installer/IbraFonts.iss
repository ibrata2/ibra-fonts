; IBRA خطوط — Windows installer (per user, no administrator rights), Arabic first.
; من تصميم و تطوير و تعريب ابراهيم الخزرجي
; Built by the GitHub workflow, which passes /DAppVersion=1.0.N /DSource=<published folder>

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef Source
  #define Source "..\build\publish"
#endif

[Setup]
AppId={{8C2F6B14-3E7A-4D59-9B0E-7A41C6D2E853}
AppName=IBRA خطوط
AppVersion={#AppVersion}
AppVerName=IBRA خطوط {#AppVersion}
AppPublisher=ابراهيم الخزرجي — IBRAPROGRAM
AppPublisherURL=https://ibrata2.github.io/ibra-fonts/
AppSupportURL=https://t.me/ibraprogram
AppUpdatesURL=https://github.com/ibrata2/ibra-fonts/releases/latest
AppCopyright=من تصميم و تطوير و تعريب ابراهيم الخزرجي
VersionInfoVersion={#AppVersion}
VersionInfoDescription=IBRA خطوط — طبيب ومحرر الخطوط العربية
DefaultDirName={autopf}\IBRA Fonts
DefaultGroupName=IBRA خطوط
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
SetupIconFile=..\assets\ibra-fonts.ico
WizardImageFile=wizard-side-100.bmp,wizard-side-150.bmp,wizard-side-200.bmp
WizardSmallImageFile=wizard-corner-100.bmp,wizard-corner-150.bmp,wizard-corner-200.bmp
UninstallDisplayIcon={app}\IBRAFonts.exe
UninstallDisplayName=IBRA خطوط
OutputDir=..\build\installer
OutputBaseFilename=IBRA-Fonts-Setup
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
WizardStyle=modern
ShowLanguageDialog=no
LanguageDetectionMethod=none
MinVersion=10.0.17763
CloseApplications=no
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ChangesAssociations=yes

[Languages]
Name: "ar"; MessagesFile: "compiler:Languages\Arabic.isl"

[CustomMessages]
ar.DesktopIcon=إنشاء اختصار على سطح المكتب
ar.ContextMenu=إضافة «افحص بـ IBRA خطوط» لقائمة الزر الأيمن على ملفات الخطوط
ar.Extras=خيارات:
ar.Launch=تشغيل IBRA خطوط
ar.Inspect=افحص بـ IBRA خطوط

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; GroupDescription: "{cm:Extras}"
Name: "contextmenu"; Description: "{cm:ContextMenu}"; GroupDescription: "{cm:Extras}"

[Files]
Source: "{#Source}\*"; DestDir: "{app}"; Excludes: "*.pdb"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\IBRA خطوط"; Filename: "{app}\IBRAFonts.exe"
Name: "{autodesktop}\IBRA خطوط"; Filename: "{app}\IBRAFonts.exe"; Tasks: desktopicon

[Registry]
; Right-click a font file → "افحص بـ IBRA خطوط" (Windows 11: under "Show more options")
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.ttf\shell\IBRAFonts"; ValueType: string; ValueName: ""; ValueData: "{cm:Inspect}"; Tasks: contextmenu; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.ttf\shell\IBRAFonts"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\IBRAFonts.exe"",0"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.ttf\shell\IBRAFonts\command"; ValueType: string; ValueName: ""; ValueData: """{app}\IBRAFonts.exe"" ""%1"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.otf\shell\IBRAFonts"; ValueType: string; ValueName: ""; ValueData: "{cm:Inspect}"; Tasks: contextmenu; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.otf\shell\IBRAFonts"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\IBRAFonts.exe"",0"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.otf\shell\IBRAFonts\command"; ValueType: string; ValueName: ""; ValueData: """{app}\IBRAFonts.exe"" ""%1"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.ttc\shell\IBRAFonts"; ValueType: string; ValueName: ""; ValueData: "{cm:Inspect}"; Tasks: contextmenu; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.ttc\shell\IBRAFonts"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\IBRAFonts.exe"",0"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.ttc\shell\IBRAFonts\command"; ValueType: string; ValueName: ""; ValueData: """{app}\IBRAFonts.exe"" ""%1"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.pfb\shell\IBRAFonts"; ValueType: string; ValueName: ""; ValueData: "{cm:Inspect}"; Tasks: contextmenu; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.pfb\shell\IBRAFonts"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\IBRAFonts.exe"",0"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.pfb\shell\IBRAFonts\command"; ValueType: string; ValueName: ""; ValueData: """{app}\IBRAFonts.exe"" ""%1"""; Tasks: contextmenu

[Run]
Filename: "{app}\IBRAFonts.exe"; Description: "{cm:Launch}"; Flags: nowait postinstall skipifsilent
; After an update from inside the app (silent install), open it again.
Filename: "{app}\IBRAFonts.exe"; Flags: nowait; Check: WizardSilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/im IBRAFonts.exe /f"; Flags: runhidden; RunOnceId: "StopIbraFonts"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
{ Closes a running IBRA خطوط so every file can be replaced. Fonts already installed for the user stay installed. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Code: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/f /im IBRAFonts.exe', '', SW_HIDE, ewWaitUntilTerminated, Code);
  Sleep(500);
  Result := '';
end;
