#!/usr/bin/env python3

import os
from pathlib import Path
import json

with Path("package.json").open() as infile:
    npmPackage = json.load(infile)


old="3.1.0-alpha1"
ver=npmPackage["version"]
print(f"Update {old} to {ver}")

replaceItems = {
  f"seisplotjs_{old}_standalone.mjs": f"seisplotjs_{ver}_standalone.mjs",
  old: ver
}

def replaceInFile(dirpath, filename):
    # Read in the file
    filepath = Path(dirpath, filename)
    try:
        with open(filepath, 'r') as file :
            filedata = file.read()
    except:
        return

    changed = False
    # Replace the target string
    for k, v in replaceItems.items():
        if k in filedata:
            changed = True
        filedata = filedata.replace(k, v)

    # Write the file out again
    if changed:
        with open(filepath, 'w') as file:
            file.write(filedata)
            print(f"Update {dirpath}/{filename}")

stuffToChange = ['docs/api/*.html', 'src', 'test', 'testremotes']
for stuff in stuffToChange:
    for toppath in Path('.').glob(stuff):
        for dirpath, dirs, files in os.walk(toppath):
            for filename in files:
                if (filename.endswith('.html') or filename.endswith('.ts') or filename.endswith('.js')):
                    replaceInFile(dirpath, filename)