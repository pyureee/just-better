; Narrowed adaptation of Ultimate Lancer's ahkMonitor.ahk.
; Observes only configured game keys; never sends or suppresses keystrokes.
#SingleInstance Off
#NoTrayIcon
#KeyHistory 0
#Persistent
#InstallKeybdHook
#InstallMouseHook
#MaxHotkeysPerInterval 999999
SetBatchLines -1
stdout := FileOpen("*", "w `n")
chatOpen := false
wasActive := false
parentPid := A_Args[8]
Hotkey, IfWinActive, ahk_exe TERA.exe
Hotkey, % "~" A_Args[1], spring, On
Hotkey, % "~" A_Args[2], onslaught, On
Hotkey, % "~" A_Args[3], wallop, On
Hotkey, % "~" A_Args[4], cancel, On
Hotkey, % "~" A_Args[5], cancel, On
Hotkey, % "~" A_Args[6], divine, On
Hotkey, % "~" A_Args[7], leap, On
Hotkey, ~Enter, chat, On
Hotkey, ~Escape, escape, On
SetTimer, focusCheck, 50
return

spring:
if (!chatOpen)
    emit("spring")
return

onslaught:
if (!chatOpen)
    emit("onslaught")
return

wallop:
if (!chatOpen)
    emit("wallop")
return

divine:
if (!chatOpen)
    emit("divine")
return

leap:
if (!chatOpen)
    emit("leap")
return

cancel:
emit("cancel")
return

chat:
chatOpen := !chatOpen
emit("cancel")
return

escape:
chatOpen := false
emit("cancel")
return

focusCheck:
Process, Exist, %parentPid%
if (!ErrorLevel)
    ExitApp
active := WinActive("ahk_exe TERA.exe")
if (wasActive && !active)
    emit("cancel")
wasActive := active
return

emit(value) {
    global stdout
    stdout.WriteLine(value)
    stdout.Read(0)
}
