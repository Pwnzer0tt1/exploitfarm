from pydantic import BaseModel
from pydantic import AwareDatetime
from db import UnHashedClientID, ClientID

###-- Client Models --###

class ClientDTO(BaseModel): #Client id will be hashed before returning to make it secret (it's a soft secret, not a real one)
    id: ClientID            #Using the hash we can only delete the client, but not edit it
    name: str|None = None
    created_at: AwareDatetime
    
class ClientAddForm(BaseModel):
    id: UnHashedClientID
    name: str|None = None

class ClientEditForm(BaseModel):
    name: str|None = None