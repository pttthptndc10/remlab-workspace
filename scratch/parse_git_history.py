import re

with open('scratch/git_history_diff.txt', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

matches = re.findall(r'(\{[^{}]*"price"[^{}]*\})', text)

with open('scratch/found_git_prices.txt', 'w', encoding='utf-8') as out:
    for m in set(matches):
        out.write(m + "\n\n")

print(f"Saved {len(set(matches))} price objects to scratch/found_git_prices.txt")
