import os
import subprocess
import json
import re

print("=== 1. SEARCHING GIT LOG & COMMIT HISTORY ===")
try:
    git_log = subprocess.check_output(['git', 'log', '-p', '-n', '50'], cwd=r'd:\QUAN_LY_REMLAB\remlab-workspace', encoding='utf-8', errors='ignore')
    print("Git log length:", len(git_log))
    # search for component names or prices in git log
    lines = git_log.split('\n')
    for l in lines:
        if any(k in l.lower() for k in ['price', 'quantity', 'shop', 'linh kiện', 'gợmlinhkien', 'mpu6050', 'arduino', 'stm32', 'esp32', 'servo', 'motor', 'pin', 'vnd']):
            print("Git line:", l[:150])
except Exception as e:
    print("Git log error:", e)

print("\n=== 2. SEARCHING ENTIRE WORKSPACE REPO FOR DATA FILES ===")
ws = r'd:\QUAN_LY_REMLAB'
for root, dirs, files in os.walk(ws):
    for f in files:
        if not f.endswith('.node') and not '.next' in root and not 'node_modules' in root and not '.git' in root:
            fp = os.path.join(root, f)
            try:
                size = os.path.getsize(fp)
                if size < 5000000: # < 5MB
                    with open(fp, 'r', encoding='utf-8', errors='ignore') as in_f:
                        txt = in_f.read()
                        if 'price' in txt and 'shop' in txt:
                            print(f"Found component structure in file: {fp} (size: {size})")
                            matches = re.findall(r'(\{[^{}]*name[^{}]*price[^{}]*\})', txt)
                            for m in matches[:5]:
                                print("   Match:", m[:150])
            except Exception as ex:
                pass

print("\n=== 3. SEARCHING ALL BRAIN TRANSCRIPTS FOR EXACT COMPONENT JSON ===")
brain_dir = r'C:\Users\PHAM THE TOAN\.gemini\antigravity\brain'
exact_components = []
for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f.endswith('.jsonl') or f.endswith('.log') or f.endswith('.json') or f.endswith('.txt'):
            fp = os.path.join(root, f)
            try:
                with open(fp, 'r', encoding='utf-8', errors='ignore') as in_f:
                    txt = in_f.read()
                    # Look for arrays containing name, price, quantity, shop
                    arrs = re.findall(r'(\[\s*\{\s*"id"[^\]]*"name"[^\]]*"price"[^\]]*\])', txt)
                    for a in arrs:
                        exact_components.append((fp, a))
            except Exception as ex:
                pass

print(f"Found {len(exact_components)} exact component array matches in brain logs.")
for fp, a in exact_components[:10]:
    print(f"File: {fp}\nContent: {a[:300]}\n")
