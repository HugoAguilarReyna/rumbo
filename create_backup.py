import shutil
import os
import datetime
from pathlib import Path

def create_backup():
    # Configuration
    project_root = Path(__file__).parent.resolve()
    backup_dir = project_root / "backups"
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_filename = f"Backup_GAG_PM_DASH_{timestamp}"
    backup_path = backup_dir / backup_filename

    # Ensure backup directory exists
    backup_dir.mkdir(exist_ok=True)
    
    # Define ignore patterns
    ignore_patterns = shutil.ignore_patterns(
        "__pycache__", 
        "*.pyc", 
        ".git", 
        ".gitignore", 
        "venv", 
        "env", 
        ".env", 
        "node_modules", 
        "backups", 
        ".idea", 
        ".vscode",
        "*.zip",
        "tmp",
        ".gemini"
    )

    print(f"Starting backup for: {project_root}")
    print(f"Destination: {backup_path}.zip")

    try:
        # Create a temp directory to hold filtered files
        temp_dir = backup_dir / f"temp_{timestamp}"
        
        shutil.copytree(
            src=project_root, 
            dst=temp_dir, 
            ignore=ignore_patterns
        )
        
        # Create zip archive from the temp directory
        shutil.make_archive(
            base_name=str(backup_path),
            format='zip',
            root_dir=temp_dir
        )
        
        # Clean up temp directory
        shutil.rmtree(temp_dir)
        
        print(f"✅ Backup created successfully: {backup_path}.zip")
        return str(backup_path) + ".zip"
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        return None

if __name__ == "__main__":
    create_backup()
