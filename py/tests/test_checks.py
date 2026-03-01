from piper_py.checks import ALL_CHECKS_BY_NAME, FULL_CHECKS


def test_all_checks_by_name_has_all_checks():
    assert len(ALL_CHECKS_BY_NAME) == len(FULL_CHECKS)


def test_all_checks_by_name_strips_prefix():
    for name in ALL_CHECKS_BY_NAME:
        assert ":" not in name


def test_all_checks_by_name_contains_expected_keys():
    expected = {"format", "lint", "type", "arch", "deadcode", "security", "complexity", "semgrep"}
    assert set(ALL_CHECKS_BY_NAME.keys()) == expected
