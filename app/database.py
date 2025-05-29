from .extensions import db
from datetime import datetime, timezone

class CanvasState(db.Model):
    __tablename__ = "canvas_state"
    id = db.Column(db.Integer, primary_key=True)
    canvas_array = db.Column(db.LargeBinary, nullable=False)

class PixelStates(db.Model):
    __tablename__ = "pixel_states"
    id = db.Column(db.Integer, primary_key=True)
    x = db.Column(db.Integer, nullable=False)
    y = db.Column(db.Integer, nullable=False)
    color = db.Column(db.String(8), nullable=False) 
    username = db.Column(db.String(64), nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ChatMessages(db.Model):
    __tablename__ = "chat_messages"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64))
    message = db.Column(db.String(512))
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))