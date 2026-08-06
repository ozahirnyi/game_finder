import pytest
from pydantic import ValidationError

from app.schemas import PriceAlertCreate


def test_any_discount_alert_rejects_a_threshold():
    with pytest.raises(ValidationError, match="any_discount must not have a threshold"):
        PriceAlertCreate(
            identity_kind="rawg",
            identity_value="30",
            title="Hades",
            mode="any_discount",
            threshold=10,
            in_app=True,
            telegram=False,
        )
