import subprocess
import re

try:
    log = subprocess.check_output(['git', 'log', '-p', '--all'], cwd=r'd:\QUAN_LY_REMLAB\remlab-workspace', encoding='utf-8', errors='ignore')
    with open('scratch/git_history_diff.txt', 'w', encoding='utf-8') as f:
        f.write(log)
    print("Git log written to scratch/git_history_diff.txt. Length:", len(log))
except Exception as e:
    print("Error getting git log:", e)
