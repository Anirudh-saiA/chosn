"""Tests for dbconn. Run: python -m unittest discover -s scripts -p "test_dbconn.py""""
import os
import subprocess
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))
import dbconn  # noqa: E402


def done(stdout="", stderr="", code=0):
    return subprocess.CompletedProcess([], code, stdout, stderr)


class DbconnTest(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, {}, clear=False)
        self.env.start()
        for k in ("DATABASE_URL", "CHOSN_PG_CONTAINER", "CHOSN_PG_USER", "CHOSN_PG_DB"):
            os.environ.pop(k, None)

    def tearDown(self):
        self.env.stop()

    def test_falls_back_to_docker_when_url_unset(self):
        with mock.patch("subprocess.run", return_value=done("a|b\n")) as run:
            self.assertEqual(dbconn.psql("select 1"), [["a", "b"]])
        argv = run.call_args.args[0]
        self.assertEqual(argv[:5], ["docker", "exec", "-i", "chosn-postgres-1", "psql"])
        self.assertIn("chosn_dev", argv)
        self.assertEqual(run.call_args.kwargs["input"], "select 1")

    def test_docker_names_can_be_overridden(self):
        os.environ.update(CHOSN_PG_CONTAINER="other", CHOSN_PG_USER="u", CHOSN_PG_DB="d")
        with mock.patch("subprocess.run", return_value=done()) as run:
            dbconn.psql("select 1")
        argv = run.call_args.args[0]
        self.assertIn("other", argv)
        self.assertEqual(argv[argv.index("-U") + 1], "u")
        self.assertEqual(argv[argv.index("-d") + 1], "d")

    def test_uses_database_url_without_docker_and_hides_password(self):
        os.environ["DATABASE_URL"] = "postgres://app:p%40ss@db.example.com:6543/chosn?sslmode=require"
        with mock.patch("subprocess.run", return_value=done("1\n")) as run:
            self.assertEqual(dbconn.psql("select 1"), [["1"]])
        argv = run.call_args.args[0]
        env = run.call_args.kwargs["env"]
        self.assertEqual(argv[0], "psql")
        self.assertNotIn("docker", argv)
        self.assertFalse(any("p@ss" in a or "p%40ss" in a for a in argv))
        self.assertEqual((env["PGHOST"], env["PGPORT"], env["PGUSER"], env["PGDATABASE"]),
                         ("db.example.com", "6543", "app", "chosn"))
        self.assertEqual(env["PGPASSWORD"], "p@ss")
        self.assertEqual(env["PGSSLMODE"], "require")

    def test_rejects_a_url_that_is_not_postgres(self):
        os.environ["DATABASE_URL"] = "mysql://x@y/z"
        with self.assertRaises(dbconn.PsqlError):
            dbconn.psql("select 1")

    def test_error_carries_psql_message_only(self):
        os.environ["DATABASE_URL"] = "postgres://app:secret@h/d"
        with mock.patch("subprocess.run", return_value=done(stderr="ERROR: boom" + "x" * 900, code=3)):
            with self.assertRaises(dbconn.PsqlError) as cm:
                dbconn.psql("bad")
        self.assertEqual(len(str(cm.exception)), 400)
        self.assertNotIn("secret", str(cm.exception))

    def test_fetch_false_returns_none_and_raw_returns_text(self):
        with mock.patch("subprocess.run", return_value=done("x|y\n")):
            self.assertIsNone(dbconn.psql("update t set a=1", fetch=False))
            self.assertEqual(dbconn.psql_raw("select"), "x|y\n")

    def test_blank_lines_are_dropped_and_empty_result_is_empty_list(self):
        with mock.patch("subprocess.run", return_value=done("\n\n")):
            self.assertEqual(dbconn.psql("select"), [])
        with mock.patch("subprocess.run", return_value=done("1|2\n\n3|4\n")):
            self.assertEqual(dbconn.psql("select"), [["1", "2"], ["3", "4"]])

    def test_missing_client_gives_a_clear_error(self):
        os.environ["DATABASE_URL"] = "postgres://a:b@h/d"
        with mock.patch("subprocess.run", side_effect=FileNotFoundError):
            with self.assertRaises(dbconn.PsqlError) as cm:
                dbconn.psql("select 1")
        self.assertIn("psql", str(cm.exception))


if __name__ == "__main__":
    unittest.main()
