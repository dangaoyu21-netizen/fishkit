# 小肥鱼 · 把一段文字画成二维码（2026-11-06）
# 从 stdin 读那段文字，往 stdout 输出一行 data:image/png;base64,…。
# 用 bili-duty 那间 venv 里的 qrcode（已经装了）。

import base64
import io
import sys

try:
    import qrcode
except Exception as e:  # noqa: BLE001
    print("ERR " + str(e))
    sys.exit(0)

文字 = sys.stdin.read().strip()
if not 文字:
    print("ERR 空的")
    sys.exit(0)

img = qrcode.make(文字)
buf = io.BytesIO()
img.save(buf, format="PNG")
print("data:image/png;base64," + base64.b64encode(buf.getvalue()).decode())
