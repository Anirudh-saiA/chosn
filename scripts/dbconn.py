"""One way for the Python scripts to reach Postgres, with no dependence on this PC.

    from dbconn import psql, psql_raw

    rows = psql("select id, slug from retailers")     # list of rows, each a list of strings
    psql("update ...", fetch=False)                     # run, return None
    text = psql_raw(sql)                                # raw stdout, for multi-statement scripts

With DATABASE_URL set (postgres://user:pass@host:port/db?sslmode=require) it runs the `psql`
client against that database. With it unset it falls back to the local Docker container the
scripts have always used (CHOSN_PG_CONTAINER, CHOSN_PG_USER, CHOSN_PG_DB override the defaults
chosn-postgres-1 / postgres / chosn_dev). SQL goes in on stdin and the password goes in the
environment, so neither shows up in the process list. Failures raise PsqlError with the first
400 characters of psql's own message, which never contains the connection string.
"""
import os
import subprocess
from urllib.parse import parse_qs, unquote, urlparse

FLAGS = ["-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-F", "|"]


class PsqlError(RuntimeError):
    pass


def _pg_env(url):
    """PG* environment variables for a postgres:// URL."""
    u = urlparse(url)
    if u.scheme not in ("postgres", "postgresql") or not u.hostname:
        raise PsqlError("DATABASE_URL must look like postgres://user:password@host:port/database")
    env = {"PGHOST": u.hostname, "PGDATABASE": unquote(u.path.lstrip("/"))}
    if u.port:
        env["PGPORT"] = str(u.port)
    if u.username:
        env["PGUSER"] = unquote(u.username)
    if u.password:
        env["PGPASSWORD"] = unquote(u.password)
    for key, var in (("sslmode", "PGSSLMODE"), ("sslrootcert", "PGSSLROOTCERT"), ("connect_timeout", "PGCONNECT_TIMEOUT")):
        if key in parse_qs(u.query):
            env[var] = parse_qs(u.query)[key][0]
    return env


def _command():
    """(argv, extra environment) for the active connection."""
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return ["psql", *FLAGS], _pg_env(url)
    container = os.environ.get("CHOSN_PG_CONTAINER", "chosn-postgres-1")
    user = os.environ.get("CHOSN_PG_USER", "postgres")
    db = os.environ.get("CHOSN_PG_DB", "chosn_dev")
    return ["docker", "exec", "-i", container, "psql", "-U", user, "-d", db, *FLAGS], {}


def psql_raw(sql):
    """Run `sql` and return psql's stdout as text."""
    argv, extra = _command()
    try:
        proc = subprocess.run(argv, input=sql, capture_output=True, text=True, encoding="utf-8",
                              env={**os.environ, **extra})
    except FileNotFoundError as e:
        raise PsqlError(f"{argv[0]} not found: set DATABASE_URL and install the psql client, or start the Docker container") from e
    if proc.returncode != 0:
        raise PsqlError(proc.stderr[:400])
    return proc.stdout


def psql(sql, fetch=True):
    """Run `sql`. With fetch (default) return the rows as lists of strings, else None."""
    out = psql_raw(sql)
    if not fetch:
        return None
    return [line.split("|") for line in out.strip().splitlines() if line]
