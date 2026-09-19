#!/usr/bin/env python3
"""
SkinPro ML Backend - Flask Application Entry Point
AWS Amplify / Lambda compatible
"""

import os
import sys

# Add ml folder to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ml'))

# Import the server from ml/server.py
try:
    from ml.server import app  # noqa: F401
except ImportError:
    # Fallback: create a minimal Flask app if import fails
    from flask import Flask
    app = Flask(__name__)
    
    @app.route('/health')
    def health():
        return {'status': 'Backend is running', 'service': 'SkinPro ML API'}, 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host=host, port=port, debug=debug)
