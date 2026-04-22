"""
preprocess.py
=============
แปลง raw CSI packets → feature vector (416,) สำหรับส่งเข้า LSTM

Config โหลดจาก env vars (ตั้งค่าให้ตรงกับ model ที่ train):
  CSI_WINDOW_SIZE   (default: 200)
  CSI_STRIDE        (default: 50)
  CSI_SEQUENCE_LEN  (default: 10)

หรือส่งตรงเข้า CSIBuffer:
  buf = CSIBuffer(window_size=200, stride=50, sequence_len=10)
"""

import os
import numpy as np
from collections import deque
from scipy import stats
from scipy.signal import savgol_filter

# =================== Config ===================
N_SUBCARRIERS = 52
N_FEATURES    = N_SUBCARRIERS * 8  # 416

# โหลดจาก env — เปลี่ยนแค่ env var เมื่อ deploy model ใหม่
WINDOW_SIZE  = int(os.getenv("CSI_WINDOW_SIZE",  200))
STRIDE       = int(os.getenv("CSI_STRIDE",        50))
SEQUENCE_LEN = int(os.getenv("CSI_SEQUENCE_LEN",  10))


def parse_csi_line(raw_line: str):
    try:
        start  = raw_line.index("[")
        end    = raw_line.index("]")
        data   = raw_line[start+1:end].strip()
        values = list(map(int, data.split()))

        if len(values) >= N_SUBCARRIERS * 2:
            I = np.array(values[0::2][:N_SUBCARRIERS], dtype=float)
            Q = np.array(values[1::2][:N_SUBCARRIERS], dtype=float)
            return np.sqrt(I**2 + Q**2)
        else:
            return np.array(values[:N_SUBCARRIERS], dtype=float)
    except Exception:
        return None


def extract_features(window: np.ndarray) -> np.ndarray:
    features = []
    for sub in range(N_SUBCARRIERS):
        col  = window[:, sub]
        mean = np.mean(col)
        std = np.std(col)
        if std < 1e-10:
            skew_val = 0.0
            kurt_val = 0.0
        else:
            skew_val = float(stats.skew(col))
            kurt_val = float(stats.kurtosis(col))
        features.extend([
            mean,
            np.min(col),
            np.max(col),
            std,
            np.mean(np.abs(col - mean)),
            float(np.percentile(col, 75) - np.percentile(col, 25)),
            skew_val,
            kurt_val,
        ])
    feat = np.array(features, dtype=np.float32)
    return np.nan_to_num(feat, nan=0.0, posinf=0.0, neginf=0.0)


class CSIBuffer:
    """Buffer สำหรับเก็บ CSI packets แบบ real-time

    Args:
        window_size:  packets ต่อ 1 window   (ต้องตรงกับ training)
        stride:       stride ระหว่าง windows (ต้องตรงกับ training)
        sequence_len: จำนวน windows ต่อ sequence เข้า LSTM
    """

    def __init__(
        self,
        window_size:  int = WINDOW_SIZE,
        stride:       int = STRIDE,
        sequence_len: int = SEQUENCE_LEN,
    ):
        self.window_size  = window_size
        self.stride       = stride
        self.sequence_len = sequence_len

        total_needed = window_size + (sequence_len - 1) * stride
        self._buf = deque(maxlen=total_needed)

    def _total_needed(self) -> int:
        return self.window_size + (self.sequence_len - 1) * self.stride

    def add_packet(self, raw_line: str):
        amp = parse_csi_line(raw_line)
        if amp is not None:
            self._buf.append(amp)

    def add_amplitude(self, amp: np.ndarray):
        self._buf.append(amp)

    def ready(self) -> bool:
        return len(self._buf) >= self.window_size

    def get_features(self) -> list:
        """Return (sequence_len, 416) as list of list

        ใช้ window ล่าสุดอันเดียว ซ้ำ sequence_len ครั้ง
        เพราะ training sequences มาจากข้ามไฟล์ (แต่ละ window เป็นอิสระ)
        ไม่ใช่จาก sliding window ที่ซ้อนกัน
        """
        arr = np.array(list(self._buf)[-self.window_size:])

        if len(arr) >= 11:
            arr = savgol_filter(arr, window_length=11, polyorder=3, axis=0)

        feat = extract_features(arr).tolist()
        return [feat] * self.sequence_len  # (sequence_len, 416)

    def size(self) -> int:
        return len(self._buf)

    def clear(self):
        self._buf.clear()
