from flask import Blueprint, render_template, jsonify, request
from .database import PixelStates
from datetime import datetime, timezone
import os

bp = Blueprint("main", __name__)

@bp.route("/", methods=["GET"])
def index():
    ws_url = os.getenv("WS_URL", "ws://localhost:5000")
    return render_template("index.html", WS_URL=ws_url)

@bp.route("/api/tileInfo", methods=["GET"])
def tile_info():
    x = int(request.args.get("x"))
    y = int(request.args.get("y"))
    pixel = PixelStates.query.filter_by(x=x, y=y).order_by(PixelStates.timestamp.desc()).first()
    if pixel:
        now = datetime.now(timezone.utc)
        pixel_time = pixel.timestamp
        if pixel_time.tzinfo is None:
            pixel_time = pixel_time.replace(tzinfo=timezone.utc)
        seconds_ago = int((now - pixel_time).total_seconds())
        
        return jsonify({
            "username": pixel.username,
            "color": pixel.color,
            "x": pixel.x,
            "y": pixel.y,
            "seconds_ago": seconds_ago
        })
    else:
        return jsonify({"error": "No tile data"}), 404