import os
import json
import re

brain_dir = r'C:\Users\PHAM THE TOAN\.gemini\antigravity\brain'

found_user_inputs = []

for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f.endswith('.jsonl') or f.endswith('.json') or f.endswith('.log') or f.endswith('.md'):
            fp = os.path.join(root, f)
            try:
                with open(fp, 'r', encoding='utf-8', errors='ignore') as file_in:
                    content = file_in.read()
                    prompts = re.findall(r'"USER_INPUT"[^\n]+', content)
                    for p in prompts:
                        found_user_inputs.append(p)
            except Exception as e:
                pass

with open('scratch/user_inputs.txt', 'w', encoding='utf-8') as out:
    out.write('\n'.join(list(set(found_user_inputs))))

print("Saved user inputs to scratch/user_inputs.txt. Count:", len(found_user_inputs))
