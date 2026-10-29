import json
from pathlib import Path
import pytest

ROWS = json.loads(Path("data/exercises.json").read_text())


@pytest.mark.parametrize("row", ROWS, ids=[x["lessonId"] for x in ROWS])
def test_exercise_solution_satisfies_its_contract(row):
    namespace = {}
    exec(row["solution"], namespace)
    exec(row["check"], namespace)
