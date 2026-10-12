"""The regulator family definitions, for ordering and tooltips."""
import yaml
from _common import C, emit_json
fam = yaml.safe_load((C.SPEC / "regulator_families.yaml").read_text())
emit_json([{"name": f["name"], "note": f["note"], "members": f["members"]}
           for f in fam["families"]])
