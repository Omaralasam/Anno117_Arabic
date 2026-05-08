Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = appDir

cmd = "cmd /c cd /d """ & appDir & """ && ""node_modules\.bin\electron.cmd"" ."
shell.Run cmd, 0, False
