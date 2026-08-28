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
    ' Use cmd /k so the window stays open to read status / logs
    cmd = "cmd.exe /k node.exe " & scriptArgs
    
    ' Run in a visible window (1 = normal window)
    WshShell.Run cmd, 1, False
End If
