# Manda un fichero de bytes TAL CUAL a una impresora de Windows (datatype RAW).
# Sin esto, el driver convertiría los comandos ESC/POS en texto y saldría basura.
# Uso: powershell -File raw-print.ps1 -Impresora "TPV-Termica" -Fichero "ticket.bin"
param(
  [Parameter(Mandatory = $true)][string]$Impresora,
  [Parameter(Mandatory = $true)][string]$Fichero
)

$codigo = @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public static class ImpresoraRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static string Enviar(string impresora, byte[] datos) {
    IntPtr h;
    if (!OpenPrinter(impresora, out h, IntPtr.Zero))
      return "no se pudo abrir la impresora (error " + Marshal.GetLastWin32Error() + ")";
    try {
      DOCINFO di = new DOCINFO();
      di.pDocName = "TPV ESC/POS";
      di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) return "StartDocPrinter falló (" + Marshal.GetLastWin32Error() + ")";
      if (!StartPagePrinter(h)) return "StartPagePrinter falló (" + Marshal.GetLastWin32Error() + ")";
      IntPtr buf = Marshal.AllocCoTaskMem(datos.Length);
      try {
        Marshal.Copy(datos, 0, buf, datos.Length);
        int escritos;
        if (!WritePrinter(h, buf, datos.Length, out escritos))
          return "WritePrinter falló (" + Marshal.GetLastWin32Error() + ")";
        EndPagePrinter(h);
        EndDocPrinter(h);
        return "ok:" + escritos;
      } finally { Marshal.FreeCoTaskMem(buf); }
    } finally { ClosePrinter(h); }
  }
}
'@

Add-Type -TypeDefinition $codigo -Language CSharp | Out-Null
$bytes = [System.IO.File]::ReadAllBytes($Fichero)
$res = [ImpresoraRaw]::Enviar($Impresora, $bytes)
Write-Output ("$($bytes.Length) bytes -> $Impresora : $res")
