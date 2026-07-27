import os
import json
import re

logs_dir = r'C:\Users\PHAM THE TOAN\.gemini\antigravity\brain\7f06cc15-997d-43e5-b57c-5a9f41337b65\.system_generated\logs'

all_text = ""
for root, dirs, files in os.walk(logs_dir):
    for f in files:
        if f.endswith('.jsonl') or f.endswith('.log'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                all_text += fp.read() + "\n"

print("Total log text length:", len(all_text))

# Search for projects
proj_matches = set(re.findall(r'"name"\s*:\s*"([^"]+)"', all_text))
print("All project names found in logs:", proj_matches)

# Search for tasks
task_matches = set(re.findall(r'"title"\s*:\s*"([^"]+)"', all_text))
print("All task titles found in logs:", task_matches)

# Search for component file contents
comp_contents = re.findall(r'(\[\s*\{\s*"id"[^\]]+\])', all_text)
print(f"Found {len(comp_contents)} JSON array component snippets.")
for idx, c in enumerate(set(comp_contents)):
    print(f"--- Snippet {idx} ---")
    print(c[:400])
