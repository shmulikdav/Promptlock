# VHS tape file — records a terminal GIF of the prompt-lock demo
# Install: https://github.com/charmbracelet/vhs
# Usage:   vhs demo.tape
#
# This produces demo.gif — perfect for README, LinkedIn, or Twitter.

Output demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 900
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20

Type "# prompt-lock: Jest for LLM prompts"
Enter
Sleep 1s

Type "# Let's run the demo (no API keys needed)"
Enter
Sleep 500ms

Type "node demo.js"
Enter
Sleep 6s

Type ""
Enter
Sleep 1s

Type "# The broken prompts failed — just like a broken test in CI."
Enter
Sleep 2s

Type "# Let's look at the HTML report:"
Enter
Sleep 500ms

Type "ls .promptlock-demo/reports/"
Enter
Sleep 2s

Type ""
Enter
Sleep 1s

Type "# Add 'prompt-lock run --ci' to your pipeline. Done."
Enter
Sleep 3s
