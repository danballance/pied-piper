from piper_py.checks import (
    ALL_CHECKS_BY_NAME,
    FULL_CHECKS,
    STRICT_CHECKS,
    STRICT_ONLY_CHECKS,
)


def test_strict_only_checks_has_lint_strict():
    names = [c.name for c in STRICT_ONLY_CHECKS]
    assert names == ["py:lint-strict"]


def test_strict_checks_includes_full_and_strict_only():
    assert STRICT_CHECKS == FULL_CHECKS + STRICT_ONLY_CHECKS


def test_all_checks_by_name_contains_lint_strict():
    assert "lint-strict" in ALL_CHECKS_BY_NAME


def test_all_checks_by_name_has_all_checks():
    assert len(ALL_CHECKS_BY_NAME) == len(FULL_CHECKS) + len(STRICT_ONLY_CHECKS)


def test_all_checks_by_name_strips_prefix():
    for name in ALL_CHECKS_BY_NAME:
        assert ":" not in name


def test_all_checks_by_name_contains_expected_keys():
    expected = {
        "format",
        "lint",
        "type",
        "arch",
        "deadcode",
        "security",
        "complexity",
        "semgrep",
        "lint-strict",
    }
    assert set(ALL_CHECKS_BY_NAME.keys()) == expected
