' ───────────────────────────────────────────────────────────────────────────
' Arranca el servicio de impresión SIN ventana.
'
' La tarea programada podría llamar a node directamente, pero entonces el TPV
' del bar tendría una consola negra abierta toda la jornada: alguien acaba
' cerrándola y las comandas dejan de salir sin que nadie se entere. Esto lo
' lanza oculto.
'
' Todo lo que el servicio escribe va a `logs\impresion.log`, que es donde hay
' que mirar cuando «no imprime»: al estar oculto, si no se guardara no habría
' forma de saber qué pasó.
' ───────────────────────────────────────────────────────────────────────────
Option Explicit

Dim shell, fso, raiz, logs, comando
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' La raíz del repo es la carpeta que contiene a scripts\
raiz = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
logs = raiz & "\logs"
If Not fso.FolderExists(logs) Then fso.CreateFolder(logs)

shell.CurrentDirectory = raiz

' `cmd /c` para poder redirigir la salida al log. El 0 final es lo que lo deja
' sin ventana; el False es para no esperar a que termine (no termina nunca).
'
' El log queda en UTF-8, que es como escribe node. Para leerlo desde
' PowerShell hay que decírselo (`Get-Content -Encoding UTF8`): por defecto
' asume la codificación del sistema y los acentos salen como «â†'».
comando = "cmd /c node ""scripts\impresion-automatica.mjs"" >> ""logs\impresion.log"" 2>&1"
shell.Run comando, 0, False
