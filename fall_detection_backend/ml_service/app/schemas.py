from pydantic import BaseModel
from typing import List

class PredictRequest(BaseModel):
    """
    features : list of 416 floats (1 window)
               หรือ list of list (หลาย windows = 1 sequence)
    """
    features: List[List[float]]  # (seq_len, 416) หรือ (n_windows, 416)