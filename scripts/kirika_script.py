python -c "
import json
with open(r'C:\Users\Do Anh Tu\.gemini\antigravity\brain\6dd50678-982c-4de0-aa9e-58f473286127\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8', errors='ignore') as f:
    for i, line in enumerate(f):
        if 'Kirika.bikini.zip' in line:
            data = json.loads(line)
            tool_calls = data.get('tool_calls', [])
            for tc in tool_calls:
                cmd = tc.get('args', {}).get('CommandLine', '')
                if 'Kirika.bikini.zip' in cmd:
                    with open('scripts/kirika_script.py', 'w', encoding='utf-8') as out:
                        out.write(cmd)
                    print('Found at step', data.get('step_index'))
"