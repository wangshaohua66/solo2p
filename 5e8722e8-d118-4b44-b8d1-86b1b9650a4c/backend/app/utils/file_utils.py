import os
from werkzeug.utils import secure_filename
from app.config import Config


def allowed_file(filename):
    if not filename:
        return False
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_IMAGE_EXTENSIONS


def get_upload_path(filename, subfolder='images'):
    folder = os.path.join(Config.UPLOAD_FOLDER, subfolder)
    os.makedirs(folder, exist_ok=True)
    safe_filename = secure_filename(filename)
    return os.path.join(folder, safe_filename), safe_filename


def get_file_extension(filename):
    if not filename:
        return ''
    return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''


def format_file_size(size_bytes):
    if size_bytes < 1024:
        return f'{size_bytes} B'
    elif size_bytes < 1024 * 1024:
        return f'{size_bytes / 1024:.2f} KB'
    elif size_bytes < 1024 * 1024 * 1024:
        return f'{size_bytes / (1024 * 1024):.2f} MB'
    else:
        return f'{size_bytes / (1024 * 1024 * 1024):.2f} GB'
