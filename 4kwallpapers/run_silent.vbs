Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

If WScript.Arguments.Count > 0 Then
    Dim scriptPath, scriptArgs, cmd
    scriptPath = WScript.Arguments(0)

    Dim workingDir
    workingDir = fso.GetParentFolderName(scriptPath)

    scriptArgs = ""
    For i = 0 To WScript.Arguments.Count - 1
        scriptArgs = scriptArgs & " """ & WScript.Arguments(i) & """"
    Next

    WshShell.CurrentDirectory = workingDir
    cmd = "node.exe " & scriptArgs

    ' Run completely silent (0 = hide window)
    WshShell.Run cmd, 0, False
End If
