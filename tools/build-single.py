"""Build Cricket Lab into one self-contained HTML file (images inlined).

    python3 tools/build-single.py OUT.html [--ref main] [--title "BitWicket"] [--stamp]

Builds the working tree, or a git ref with --ref. Needs esbuild (on PATH, or via npx).
--stamp adds "Build: <ref> @ <commit>" to the key strip under the game.
"""
import argparse, os, re, shutil, subprocess, sys, tempfile

ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("--ref")
ap.add_argument("--title", default="BitWicket")
ap.add_argument("--stamp", action="store_true")
args = ap.parse_args()
root = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip()

with tempfile.TemporaryDirectory() as tmp:
    if args.ref:
        archive = subprocess.run(["git", "-C", root, "archive", args.ref, "src", "assets", "index.html"], capture_output=True, check=True).stdout
        subprocess.run(["tar", "-x", "-C", tmp], input=archive, check=True)
    else:
        for item in ("src", "assets", "index.html"):
            src = os.path.join(root, item)
            (shutil.copytree if os.path.isdir(src) else shutil.copy)(src, os.path.join(tmp, item))

    # The menu's LAST VERSION: the date of the last merge in what's being built.
    merged = subprocess.run(["git", "-C", root, "log", "-1", "--merges", "--format=%cs", args.ref or "HEAD"],
                            capture_output=True, text=True).stdout.strip()
    if merged:
        version_js = os.path.join(tmp, "src", "version.js")
        code = open(version_js).read()
        open(version_js, "w").write(re.sub(r'LAST_VERSION = "[^"]*"', f'LAST_VERSION = "{merged}"', code))

    # new URL("../assets/x.png", import.meta.url) can't be bundled: turn each into an import.
    assets_js = os.path.join(tmp, "src", "assets.js")
    code = open(assets_js).read()
    imports = []
    def to_import(m):
        name = f"asset{len(imports)}"
        imports.append(f'import {name} from "{m.group(2)}";')
        return f'"{m.group(1)}": {name}'
    code = re.sub(r'"([^"]+)":\s*new URL\("([^"]+)",\s*import\.meta\.url\)', to_import, code)
    open(assets_js, "w").write("\n".join(imports) + "\n" + code)

    esbuild = shutil.which("esbuild")
    cmd = [esbuild] if esbuild else ["npx", "--yes", "esbuild"]
    bundle = os.path.join(tmp, "game.js")
    subprocess.run(cmd + [os.path.join(tmp, "src", "main.js"), "--bundle", "--minify", "--format=iife",
                          "--loader:.png=dataurl", f"--outfile={bundle}", "--log-level=warning"], check=True)

    html = open(os.path.join(tmp, "index.html")).read()
    js = open(bundle).read().replace("</script", "<\\/script")
    html = re.sub(r"<title>.*?</title>", lambda _: f"<title>{args.title}</title>", html, count=1)
    html = html.replace('<script type="module" src="src/main.js"></script>', f"<script>{js}</script>")
    if args.stamp:
        commit = subprocess.run(["git", "-C", root, "rev-parse", "--short", args.ref or "HEAD"], capture_output=True, text=True).stdout.strip()
        html = html.replace("<span><b>Esc</b> menu &amp; instructions</span>",
                            f"<span><b>Esc</b> menu &amp; instructions</span>\n      <span>Build: {args.ref or 'working tree'} @ {commit}</span>")
    open(args.out, "w").write(html)
print(f"wrote {args.out}")
