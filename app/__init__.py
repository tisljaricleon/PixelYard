import eventlet
from datetime import datetime, timezone
eventlet.monkey_patch()

import os
from flask import Flask
from dotenv import load_dotenv
from .extensions import db, socketio
from .database import CanvasState, PixelStates
import numpy as np
from .http_server import bp as main_bp
from . import websockets

def create_app():
    load_dotenv()

    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="../static",
        static_url_path="/static"
    )

    env = os.getenv("FLASK_ENV", "development").lower()
    if env == "production" and os.getenv("POSTGRES_EXTERNAL"):
        app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("POSTGRES_EXTERNAL")
    else:
        postgres_host = os.getenv('POSTGRES_HOST', 'localhost')
        app.config["SQLALCHEMY_DATABASE_URI"] = (
            f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
            f"@{postgres_host}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
        )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    socketio.init_app(app)

    app.register_blueprint(main_bp)

    with app.app_context():
        db.create_all()
        canvas = CanvasState.query.first()

        if not canvas:
            array = np.full((1000 * 1000 * 4,), 255, dtype=np.uint8)
            db.session.add(CanvasState(canvas_array=array.tobytes()))
            db.session.commit()
            canvas = CanvasState.query.first()
  
            now = datetime.now(timezone.utc)
            batch = []

            for y in range(1000):
                for x in range(1000):
                    pixel = PixelStates(
                        x=x,
                        y=y,
                        color="ffffffff",
                        username="World",
                        timestamp=now
                    )
                    batch.append(pixel)

                    if len(batch) >= 1000:
                        db.session.bulk_save_objects(batch)
                        db.session.commit()
                        batch = []

            if batch:
                db.session.bulk_save_objects(batch)
                db.session.commit()

    return app