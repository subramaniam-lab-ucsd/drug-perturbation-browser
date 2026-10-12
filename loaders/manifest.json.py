"""Build provenance, so a stale build is detectable from inside the app."""
import json, subprocess, datetime
from _common import REPO, C, emit_json

def git(*a):
    try:
        return subprocess.run(["git", *a], cwd=REPO, capture_output=True,
                              text=True, timeout=20).stdout.strip()
    except Exception:
        return None

emit_json({
    "built_at": datetime.datetime.now().isoformat(timespec="seconds"),
    "git_sha_short": git("rev-parse", "--short", "HEAD"),
    "git_dirty": bool(git("status", "--porcelain")),
    "sources": json.loads((C.CALIB / "sources.json").read_text()),
})
