import json
import re

log_path = r'C:\Users\PHAM THE TOAN\.gemini\antigravity\brain\7f06cc15-997d-43e5-b57c-5a9f41337b65\.system_generated\logs\transcript.jsonl'

with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

output = []
for idx, l in enumerate(lines):
    if any(k in l.lower() for k in ['component', 'linhkien', 'shop', 'đơn giá', 'giá', 'quantity', 'tháng 7', 'gom']):
        output.append(f"Line {idx}: {l[:500]}")

with open('scratch/found_components.txt', 'w', encoding='utf-8') as out:
    out.write('\n'.join(output))

print(f"Done scanning {len(lines)} lines. Output written to scratch/found_components.txt. Found {len(output)} matching lines.")
