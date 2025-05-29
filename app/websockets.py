from .extensions import socketio, db
from flask import request
from .database import CanvasState, PixelStates
import numpy as np
import random
import json
import os
from sqlalchemy import text


users = {}
directory = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(directory, "usernames.json")
usernames = None
with open(file_path) as f:
    usernames = json.load(f)


@socketio.on("disconnect")
def disconnect():
    users.pop(request.sid, None)


@socketio.on("get_full_canvas")
def get_full_canvas():
    try:
        state = CanvasState.query.first()
        if state:
            array = np.frombuffer(state.canvas_array, dtype=np.uint8)
            socketio.emit("full_canvas_result", array.tolist(), room=request.sid)
        else:
            raise RuntimeError("No canvas state found")
    except Exception:
        socketio.emit("full_canvas_result", None, room=request.sid)
        socketio.emit("disconnect", room=request.sid)


@socketio.on("authenticate")
def authenticate(data):
    username = None
    if not data["username"]:
        username = random.choice(usernames["adjectives"]).capitalize() + random.choice(usernames["nouns"]).capitalize()
        users[request.sid] = {"username": data["username"], "x": 0, "y": 0}
    else:
        username = data["username"]

    socketio.emit("authenticate_result", {"username": username}, room=request.sid)


def set_canvas_pixels(pixels):
    if not pixels:
        return
    
    overlays = []
    params = {}
    for i, pixel in enumerate(pixels):
        index = (pixel["y"] * 1000 + pixel["x"]) * 4 + 1
        param_name = f"color_bytes_{i}"
        overlays.append(f"overlay(canvas_array placing :{param_name} from {index} for 4)")
        params[param_name] = bytes(pixel["color"])

    overlay_expr = "canvas_array"
    for expression in overlays:
        overlay_expr = expression.replace("canvas_array", overlay_expr, 1)
    sql = f"""
        UPDATE canvas_state
        SET canvas_array = {overlay_expr}
        WHERE id = (SELECT id FROM canvas_state LIMIT 1)
    """
    db.session.execute(text(sql), params)
    db.session.commit()


@socketio.on("batch_pixel_queue")
def batch_pixel_queue(data):
    try:
        pixel_states = []
        batch_pixels = []
        for pixel in data:
            pixel_states.append(PixelStates(
                x=pixel["x"], y=pixel["y"], color=pixel["color"],
                username=pixel["username"], timestamp=pixel["timestamp"]
            ))
            color = tuple(int(pixel["color"][i:i+2], 16) for i in (0, 2, 4, 6))
            batch_pixels.append({"x": pixel["x"], "y": pixel["y"], "color": color})
    
        chunk_size = 50
        for i in range(0, len(batch_pixels), chunk_size):
            set_canvas_pixels(batch_pixels[i:i+chunk_size])


        db.session.add_all(pixel_states)
        db.session.commit()
        socketio.emit("batch_pixel_ok", room=request.sid)
        socketio.emit("batch_pixel_update", {"batch": data}, skip_sid=request.sid)

    except Exception as e:
        print("EXCEPTION: ", e)
        db.session.rollback()
        print(data)
        batch = get_current_pixel_colors(data)
        socketio.emit("batch_pixel_error", {
            "message": str(e),
            "batch": batch
        }, room=request.sid)


def get_current_pixel_colors(pixels):
    from sqlalchemy import text
    canvas_id = db.session.execute(text("SELECT id FROM canvas_state LIMIT 1")).scalar()
    if not canvas_id:
        return []

    result = []
    for pixel in pixels:
        x, y = pixel["x"], pixel["y"]
        index = (y * 1000 + x) * 4 + 1
        sql = text("""
            SELECT encode(substring(canvas_array from :index for 4), 'hex')
            FROM canvas_state
            WHERE id = :canvas_id
        """)
        row = db.session.execute(sql, {"index": index, "canvas_id": canvas_id}).first()

        if row and row[0]:
            print(row)
            print(row[0])
            hexval = row[0]
            if len(hexval) == 8:
                result.append({
                    "x": x,
                    "y": y,
                    "color": hexval
                })
    return result