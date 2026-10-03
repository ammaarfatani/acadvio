$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$videoRoot = $PSScriptRoot
$audioRoot = Join-Path $videoRoot 'audio'
New-Item -ItemType Directory -Force -Path $audioRoot | Out-Null
$speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speech.SelectVoice('Microsoft David Desktop')
$speech.Rate = 0
$speech.Volume = 100
$sceneIndex = 0
foreach ($line in (Get-Content -LiteralPath (Join-Path $videoRoot 'storyboard.md') -Encoding UTF8)) {
    if ($line -match '^\| \d\d:') {
        $sceneIndex++
        $cells = $line.Split('|')
        $script = $cells[6].Trim().Trim([char]0x201C,[char]0x201D)
        $audioPath = Join-Path $audioRoot ('scene-{0:D2}.wav' -f $sceneIndex)
        $speech.SetOutputToWaveFile($audioPath)
        $speech.Speak($script)
        $speech.SetOutputToNull()
        Write-Output ('Synthesized scene {0}: {1}' -f $sceneIndex,$script)
    }
}
$speech.Dispose()
