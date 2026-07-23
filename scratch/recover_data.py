import json
import re

log_path = r'C:\Users\PHAM THE TOAN\.gemini\antigravity\brain\7f06cc15-997d-43e5-b57c-5a9f41337b65\.system_generated\logs\transcript.jsonl'

with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Let's search for user requests or text fragments mentioning projects/tasks from screenshots or transcripts
# In screenshot we saw:
# Project: GẬY CÂN BẰNG PID
# Task: code thuật
# Notes:
# - Ngày 1-3: đọc IMU, lọc dữ liệu, tính góc
# - Ngày 4-6: xuất dữ liệu serial, kiểm tra độ ổn định
# - Ngày 7-10: PID cơ
# Assignee: Phạm Thế Toàn (Admin)
# Dates: 06/07/2026 -> 15/07/2026

# Another task from screenshot:
# Task: lắp ráp cơ khí và PID

# Another task from screenshot 3:
# Task: mua linh kiện và lắp thử
# Notes: từ ngày 1 tới ngày 3 t còn dưới quê chưa lên sài gòn nên trong tgian đó t sẽ chạy mô phỏng, còn 2 ngày cuối t sẽ mua linh kiện và chạy demo
# Assignee: Phạm Thế Toàn (Admin)
# Dates: 01/07/2026 -> 05/07/2026

# File name from screenshot: GomLinhKien_mua_h_ng__t_1__th_ng_7__th_...07-03.xlsx

print("Scanned transcript text length:", len(text))
