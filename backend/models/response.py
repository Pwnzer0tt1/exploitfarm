from pydantic import BaseModel
from typing import TypeVar, Generic, Any
from models.enums import ResponseStatus, MessageStatusLevel

ResponseType = TypeVar('ResponseType', bound=Any)

class MessageResponseInvalidError(Exception):
    def __init__(self, message, response=None):
        self.message = message
        self.response = response
    
    def __str__(self):
        return self.message

class MessageResponse(BaseModel, Generic[ResponseType]):
    status: ResponseStatus = ResponseStatus.OK
    message: str|None = None
    response: ResponseType|None = None

class MessageInfo(BaseModel):
    level: MessageStatusLevel = MessageStatusLevel.warning
    title: str
    message: str
