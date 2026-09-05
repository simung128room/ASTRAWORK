import os
import zipfile

EXCLUDE_DIRS = {'node_modules', 'dist', '.git', '.cache', '__pycache__', '.temp'}
EXCLUDE_EXTS = {'.zip', '.tar', '.gz'}

def create_project_zip(output_path='jomcode-source.zip'):
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk('.'):
            # prune excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in EXCLUDE_EXTS or file.startswith('.'):
                    # allow important dotfiles
                    if file not in {'.env.example', '.gitignore'}:
                        continue
                filepath = os.path.join(root, file)
                arcname = os.path.relpath(filepath, '.')
                if arcname in {output_path, 'generate_zip.py'}:
                    continue
                zf.write(filepath, arcname)
    return output_path

if __name__ == '__main__':
    created = create_project_zip()
    print(f"Created {created} ({os.path.getsize(created)} bytes)")
