import os

brain_dir = r'C:\Users\PHAM THE TOAN\.gemini\antigravity\brain'
print("Scanning brain dir:", brain_dir)

all_files = []
for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f.endswith('.jsonl') or f.endswith('.log') or f.endswith('.json'):
            fp = os.path.join(root, f)
            all_files.append((fp, os.path.getsize(fp)))

all_files.sort(key=lambda x: x[1], reverse=True)
print(f"Found {len(all_files)} files. Top 15 largest:")
for path, size in all_files[:15]:
    print(f"- {size} bytes: {path}")
