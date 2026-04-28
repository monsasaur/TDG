import pytest
from pydantic import ValidationError

from app.schemas import PredictRequest


class TestPredictRequest:
    def test_accepts_2d_float_features(self):
        req = PredictRequest(features=[[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])
        assert len(req.features) == 2
        assert req.features[0] == [0.1, 0.2, 0.3]

    def test_accepts_empty_outer_list(self):
        # pydantic accepts empty list — business validation handled in route
        req = PredictRequest(features=[])
        assert req.features == []

    def test_rejects_missing_features_field(self):
        with pytest.raises(ValidationError):
            PredictRequest()

    def test_rejects_flat_1d_list(self):
        with pytest.raises(ValidationError):
            PredictRequest(features=[0.1, 0.2, 0.3])

    def test_rejects_non_numeric_values(self):
        with pytest.raises(ValidationError):
            PredictRequest(features=[["not", "a", "number"]])

    def test_coerces_int_to_float(self):
        req = PredictRequest(features=[[1, 2, 3]])
        assert req.features[0] == [1.0, 2.0, 3.0]
