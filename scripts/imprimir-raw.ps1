# Manda un fichero de bytes TAL CUAL a una impresora de Windows (datatype RAW).
# Sin esto, el driver convertiría los comandos ESC/POS en texto y saldría basura.
# Uso: powershell -File imprimir-raw.ps1 -Impresora "TPV-Termica" -Fichero "ticket.bin"
#
# ── Por qué no basta con que WritePrinter diga que sí ────────────────────────
#
# WritePrinter confirma que el SPOOLER aceptó los bytes, no que saliera papel.
# Con la impresora apagada, sin papel o con el USB suelto, el spooler los acepta
# igual y el trabajo se queda en la cola esperando. El TPV lo daba por impreso.
#
# Así estuvo del 12 al 28 de agosto de 2026: cada comanda decía «impresa», el
# log escribía su 🖨, y en la cola de Windows había NUEVE trabajos muertos. En
# un bar eso es la cocina sin comandas y nadie enterándose hasta que alguien
# pregunta por un plato.
#
# Por eso, después de mandarlo, se espera a que el trabajo DESAPAREZCA de la
# cola —que es como Windows dice «esto ya ha salido por el puerto»—. Si no
# desaparece, se cancela y se avisa: cancelarlo importa tanto como avisar,
# porque si no cada reintento deja otro trabajo encallado y al reconectar la
# impresora se vomitan todos de golpe.
param(
  [Parameter(Mandatory = $true)][string]$Impresora,
  [Parameter(Mandatory = $true)][string]$Fichero,
  # Un tique térmico tarda ~1 s. 8 da margen de sobra sin colgar el servicio.
  [int]$EsperaSegundos = 8,
  # Escape: vuelve al comportamiento de antes (aceptado = impreso).
  [switch]$SinConfirmar
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
  // Devuelve el ID del trabajo (0 = falló). Estaba declarada como bool, que
  // funciona —cualquier id != 0 es true— pero tiraba el dato con el que ahora
  // se comprueba si el trabajo llegó a salir.
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
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
      int job = StartDocPrinter(h, 1, di);
      if (job == 0) return "StartDocPrinter falló (" + Marshal.GetLastWin32Error() + ")";
      if (!StartPagePrinter(h)) return "StartPagePrinter falló (" + Marshal.GetLastWin32Error() + ")";
      IntPtr buf = Marshal.AllocCoTaskMem(datos.Length);
      try {
        Marshal.Copy(datos, 0, buf, datos.Length);
        int escritos;
        if (!WritePrinter(h, buf, datos.Length, out escritos))
          return "WritePrinter falló (" + Marshal.GetLastWin32Error() + ")";
        EndPagePrinter(h);
        EndDocPrinter(h);
        return "ok:" + escritos + ":job:" + job;
      } finally { Marshal.FreeCoTaskMem(buf); }
    } finally { ClosePrinter(h); }
  }
}
'@

Add-Type -TypeDefinition $codigo -Language CSharp | Out-Null
$bytes = [System.IO.File]::ReadAllBytes($Fichero)
$res = [ImpresoraRaw]::Enviar($Impresora, $bytes)

# El spooler no lo aceptó siquiera: no hay nada que confirmar.
if ($res -notmatch '^ok:(\d+):job:(\d+)$') {
  Write-Output ("$($bytes.Length) bytes -> $Impresora : $res")
  exit 1
}
$escritos = $Matches[1]
$job = [int]$Matches[2]

if ($SinConfirmar) {
  Write-Output ("$($bytes.Length) bytes -> $Impresora : ok:$escritos (sin confirmar, a peticion)")
  exit 0
}

# ── ¿Ha salido de verdad? ────────────────────────────────────────────────────
# Que el trabajo desaparezca de la cola es la señal de que el spooler lo entregó
# por el puerto. Mientras siga ahí, no ha salido papel.
$limite = (Get-Date).AddSeconds($EsperaSegundos)
$imprimiendo = $false
$ultimoEstado = ''
while ($true) {
  $j = $null
  try { $j = Get-PrintJob -PrinterName $Impresora -ID $job -ErrorAction Stop } catch { $j = $null }
  if ($null -eq $j) {
    Write-Output ("$($bytes.Length) bytes -> $Impresora : ok:$escritos (trabajo $job confirmado)")
    exit 0
  }
  $ultimoEstado = [string]$j.JobStatus
  # Si ya está saliendo por el cabezal, merece esperar un poco más: un tique
  # largo con QR puede tardar. Solo se estira una vez.
  if (-not $imprimiendo -and $ultimoEstado -match 'Printing|Retained') {
    $imprimiendo = $true
    $limite = $limite.AddSeconds($EsperaSegundos)
  }
  if ((Get-Date) -gt $limite) { break }
  Start-Sleep -Milliseconds 250
}

# No ha salido. Se cancela para que el reintento no deje otro encallado, y para
# que al reconectar la impresora no salga una montaña de tiques viejos.
$cancelado = 'no'
try { Remove-PrintJob -PrinterName $Impresora -ID $job -ErrorAction Stop; $cancelado = 'si' } catch { }

$pista = 'impresora apagada, sin papel o desconectada'
try {
  $p = Get-Printer -Name $Impresora -ErrorAction Stop
  if ($p.PrinterStatus) { $pista = "estado de la impresora: $($p.PrinterStatus)" }
} catch { }

Write-Output ("$($bytes.Length) bytes -> $Impresora : sin-confirmar: el trabajo $job seguia en la cola tras $EsperaSegundos s ($pista; estado del trabajo: $ultimoEstado; cancelado: $cancelado)")
exit 2
