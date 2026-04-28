import numpy as np
import pytest

from app.preprocess import (
    parse_csi_line,
    extract_features,
    CSIBuffer,
    N_SUBCARRIERS,
    N_FEATURES,
)


class TestParseCsiLine:
    def test_iq_pairs_returns_amplitude(self):
        # 52 subcarriers × 2 (I, Q) = 104 ints
        I_vals = [3] * N_SUBCARRIERS
        Q_vals = [4] * N_SUBCARRIERS
        interleaved = []
        for i, q in zip(I_vals, Q_vals):
            interleaved.extend([i, q])
        line = "CSI_DATA,foo,bar,[" + " ".join(map(str, interleaved)) + "]"

        amp = parse_csi_line(line)

        assert amp is not None
        assert amp.shape == (N_SUBCARRIERS,)
        # sqrt(3^2 + 4^2) = 5
        np.testing.assert_allclose(amp, np.full(N_SUBCARRIERS, 5.0))

    def test_amplitude_only_when_too_few_values(self):
        # only 52 values — fewer than 104 needed for I/Q pairs
        vals = list(range(N_SUBCARRIERS))
        line = "x,[" + " ".join(map(str, vals)) + "]"

        amp = parse_csi_line(line)

        assert amp is not None
        assert amp.shape == (N_SUBCARRIERS,)
        np.testing.assert_array_equal(amp, np.array(vals, dtype=float))

    def test_no_brackets_returns_none(self):
        assert parse_csi_line("garbage line") is None

    def test_non_integer_data_returns_none(self):
        assert parse_csi_line("[a b c d]") is None


class TestExtractFeatures:
    def test_output_shape_is_416(self):
        window = np.random.rand(200, N_SUBCARRIERS)
        feat = extract_features(window)
        assert feat.shape == (N_FEATURES,)
        assert feat.dtype == np.float32

    def test_constant_window_zero_std_no_nan(self):
        # std=0 → skew/kurt are NaN by default; preprocess must zero them
        window = np.ones((200, N_SUBCARRIERS))
        feat = extract_features(window)
        assert not np.isnan(feat).any()
        assert not np.isinf(feat).any()

    def test_known_stats_for_first_subcarrier(self):
        window = np.zeros((200, N_SUBCARRIERS))
        window[:, 0] = np.arange(200, dtype=float)
        feat = extract_features(window)

        # 8 stats per subcarrier — first 8 = subcarrier 0
        mean, mn, mx, std, *_ = feat[:8]
        assert mean == pytest.approx(99.5)
        assert mn == pytest.approx(0.0)
        assert mx == pytest.approx(199.0)
        assert std > 0


class TestCSIBuffer:
    def test_total_needed_calculation(self):
        # window=200, stride=50, seq_len=10 → 200 + 9*50 = 650
        buf = CSIBuffer(window_size=200, stride=50, sequence_len=10)
        assert buf._total_needed() == 650

    def test_ready_returns_false_below_window_size(self):
        buf = CSIBuffer(window_size=10, stride=5, sequence_len=2)
        for _ in range(5):
            buf.add_amplitude(np.zeros(N_SUBCARRIERS))
        assert buf.ready() is False

    def test_ready_returns_true_when_window_filled(self):
        buf = CSIBuffer(window_size=10, stride=5, sequence_len=2)
        for _ in range(10):
            buf.add_amplitude(np.zeros(N_SUBCARRIERS))
        assert buf.ready() is True

    def test_get_features_returns_sequence_len_windows_of_416(self):
        buf = CSIBuffer(window_size=20, stride=5, sequence_len=4)
        for _ in range(20):
            buf.add_amplitude(np.random.rand(N_SUBCARRIERS))

        features = buf.get_features()

        assert len(features) == 4
        assert all(len(w) == N_FEATURES for w in features)

    def test_clear_empties_buffer(self):
        buf = CSIBuffer(window_size=10, stride=5, sequence_len=2)
        for _ in range(10):
            buf.add_amplitude(np.zeros(N_SUBCARRIERS))
        assert buf.size() == 10

        buf.clear()
        assert buf.size() == 0
        assert buf.ready() is False

    def test_add_packet_skips_unparseable_lines(self):
        buf = CSIBuffer(window_size=10, stride=5, sequence_len=2)
        buf.add_packet("garbage")
        buf.add_packet("also garbage")
        assert buf.size() == 0
