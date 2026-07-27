import re

with open('scratch/user_inputs.txt', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

lines = text.split('\n')
matching = [l for l in lines if any(w in l.lower() for w in ['dự án', 'project', 'linh kiện', 'task', 'gậy'])]

with open('scratch/filtered_prompts.txt', 'w', encoding='utf-8') as out:
    for m in matching:
        out.write(m + "\n\n")

print(f"Saved {len(matching)} prompts to scratch/filtered_prompts.txt")
