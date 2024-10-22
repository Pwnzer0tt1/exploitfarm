import ormar, sqlalchemy, databases, env, secrets
import sqlalchemy.exc
from pydantic import AwareDatetime
from pydantic import PlainSerializer, BaseModel
from typing import Dict, Any, Annotated, List
from typing import Union, Callable
from uuid import UUID, uuid4
from utils import datetime_now
from aiocache import cached
from env import RESET_DB_DANGEROUS
from hashlib import sha256
from models.enums import *
from pydantic import BeforeValidator
from utils import *
import asyncio
from ormar import ReferentialAction

def extract_id_from_dict(x: Any) -> Any:
    if isinstance(x, dict):
        return x["id"]
    if isinstance(x, BaseModel):
        return x.id
    return x

type FkType[T] = Annotated[T|Any, PlainSerializer(lambda x: extract_id_from_dict(x), return_type=T, when_used="always")]

dbconf = ormar.OrmarConfig(
    database = databases.Database(env.POSTGRES_URL),
    metadata = sqlalchemy.MetaData(),
    engine = sqlalchemy.create_engine(env.POSTGRES_URL),
)

type EnvKey = str
class Env(ormar.Model):
    ormar_config = dbconf.copy(tablename="envs")
    
    key:    EnvKey      = ormar.String(max_length=1024, primary_key=True)
    value:  str|None    = ormar.String(max_length=1024*1024, nullable=True)
    
class BinEnv(ormar.Model):
    ormar_config = dbconf.copy(tablename="bin_envs")
    
    key:    EnvKey      = ormar.String(max_length=1024, primary_key=True)
    value:  str|None    = ormar.LargeBinary(max_length=1024*1024*1024, nullable=True)

MANUAL_CLIENT_ID = "manual"

type ClientID = str

def client_id_hashing(client_id: Any) -> ClientID:
    if isinstance(client_id, Union[dict, BaseModel]):
        client_id = extract_id_from_dict(client_id)
        if isinstance(client_id, dict):
            raise ValueError("Invalid client_id")
    try:
        if not isinstance(client_id, UUID):
            client_id = UUID(client_id)
    except Exception:
        return str(client_id)
    return "sha256-"+sha256(str(client_id).lower().encode()).hexdigest().lower()

def verify_and_parse_uuid(value: str) -> UUID:
    try:
        return client_id_hashing(UUID(value))
    except Exception:
        raise ValueError("Invalid UUID")

type UnHashedClientID = Annotated[str, BeforeValidator(verify_and_parse_uuid)]
# Auto hashing client_id if ClientID is a UnHashedClientID
class Client(ormar.Model):
    ormar_config = dbconf.copy(tablename="clients")
    
    id:         ClientID        = ormar.String(primary_key=True, max_length=1024)
    name:       str|None        = ormar.String(max_length=1024, nullable=True)
    created_at: AwareDatetime   = ormar.DateTime(timezone=True, default=datetime_now)

type ServiceID = UUID
class Service(ormar.Model):
    ormar_config = dbconf.copy(tablename="services")
    
    id:         ServiceID       = ormar.UUID(default=uuid4, primary_key=True)
    name:       str             = ormar.String(max_length=1024)
    created_at: AwareDatetime   = ormar.DateTime(timezone=True, default=datetime_now)

type ExploitID = UUID
class Exploit(ormar.Model):
    ormar_config = dbconf.copy(tablename="exploits")
    
    id:         ExploitID       = ormar.UUID(primary_key=True)
    name:       str             = ormar.String(max_length=1024)
    language:   str             = ormar.String(max_length=1024, choices=list(Language), default=Language.other.value)
    status:     str             = ormar.String(max_length=1024, choices=list(ExploitStatus), default=ExploitStatus.disabled.value)
    created_at: AwareDatetime   = ormar.DateTime(timezone=True, default=datetime_now)
    service:    Service         = ormar.ForeignKey(Service, related_name='exploits', ondelete=ReferentialAction.SET_NULL, nullable=True)
    created_by: Client          = ormar.ForeignKey(Client, related_name='exploits_created', ondelete=ReferentialAction.SET_NULL, nullable=True)

type TeamID = int
class Team(ormar.Model):
    ormar_config = dbconf.copy(tablename="teams")
    
    id:         TeamID          = ormar.Integer(primary_key=True)
    name:       str|None        = ormar.String(max_length=1024, nullable=True)
    short_name: str|None        = ormar.String(max_length=1024, nullable=True)
    host:       str             = ormar.String(max_length=1024, unique=True) #The host of the team (is a string because it can be an IP or a domain, but also in strange CTFs it can be something else)
    created_at: AwareDatetime   = ormar.DateTime(timezone=True, default=datetime_now)

type AttackGroupID = int
class AttackGroup(ormar.Model):
    ormar_config = dbconf.copy(tablename="attack_groups")
    
    id:             AttackGroupID       = ormar.Integer(primary_key=True)
    name:           str                 = ormar.String(max_length=1024, nullable=False)
    last_attack:    AwareDatetime|None  = ormar.DateTime(timezone=True, nullable=True)
    created_at:     AwareDatetime       = ormar.DateTime(timezone=True, default=datetime_now)
    exploit:        Exploit             = ormar.ForeignKey(Exploit, related_name='groups', ondelete=ReferentialAction.CASCADE)
    clients:        List[Client]|None   = ormar.ManyToMany(Client, related_name='attack_groups', nullable=True)


type ExploitSourceID = UUID
class ExploitSource(ormar.Model):
    ormar_config = dbconf.copy(tablename="exploit_sources")
    
    id:         ExploitSourceID = ormar.UUID(default=uuid4, primary_key=True)
    hash:       str             = ormar.String(max_length=1024)
    message:    str|None        = ormar.String(max_length=1024, nullable=True)
    pushed_at:  AwareDatetime   = ormar.DateTime(timezone=True, default=datetime_now)
    os_type:    str|None        = ormar.String(max_length=1024)
    distro:     str|None        = ormar.String(max_length=1024)
    arch:       str|None        = ormar.String(max_length=1024)
    pushed_by:  Client|None     = ormar.ForeignKey(Client, related_name='exploit_sources', ondelete=ReferentialAction.SET_NULL)
    exploit:    Exploit         = ormar.ForeignKey(Exploit, related_name='sources', ondelete=ReferentialAction.CASCADE)

type AttackExecutionID = int
class AttackExecution(ormar.Model):
    ormar_config = dbconf.copy(tablename="attack_executions")
    
    id:                 AttackExecutionID       = ormar.Integer(primary_key=True)
    start_time:         AwareDatetime|None      = ormar.DateTime(timezone=True, nullable=True) #Client generated, not affortable, useful for stats only
    end_time:           AwareDatetime|None      = ormar.DateTime(timezone=True, nullable=True) #Client generated, not affortable, useful for stats only
    status:             str                     = ormar.String(max_length=1024, choices=list(AttackExecutionStatus), index=True)
    error:              bytes|None              = ormar.LargeBinary(max_length=1024*1024, nullable=True) #The output of the attack if it fails or no flags are found
    received_at:        AwareDatetime           = ormar.DateTime(timezone=True, default=datetime_now, index=True) #Server generated
    target:             Team|None               = ormar.ForeignKey(Team, related_name='attacks_executions', nullable=True, index=True, ondelete=ReferentialAction.SET_NULL)
    exploit:            Exploit|None            = ormar.ForeignKey(Exploit, related_name='executions', nullable=True, index=True, ondelete=ReferentialAction.SET_NULL)
    executed_by:        Client|None             = ormar.ForeignKey(Client, related_name='attacks_executions', nullable=True, index=True, ondelete=ReferentialAction.SET_NULL)
    executed_by_group:  AttackGroup|None        = ormar.ForeignKey(AttackGroup, related_name='executions', nullable=True, index=True, ondelete=ReferentialAction.SET_NULL)
    exploit_source:     ExploitSourceID|None    = ormar.ForeignKey(ExploitSource, related_name='executions', nullable=True, ondelete=ReferentialAction.SET_NULL)
    
type FlagID = int
class Flag(ormar.Model):
    ormar_config = dbconf.copy(tablename="flags")
    
    id:                 FlagID              = ormar.Integer(primary_key=True)
    flag:               str                 = ormar.String(max_length=1024, unique=True)
    status:             str                 = ormar.String(max_length=1024, choices=list(FlagStatus), default=FlagStatus.wait.value, index=True)
    last_submission_at: AwareDatetime|None  = ormar.DateTime(timezone=True, nullable=True, index=True)
    status_text:        str|None            = ormar.String(max_length=1024, nullable=True)
    submit_attempts:    int                 = ormar.Integer(default=0)
    attack:             AttackExecution     = ormar.ForeignKey(AttackExecution, related_name='flags', ondelete=ReferentialAction.SET_NULL)

type SubmitterID = int
class Submitter(ormar.Model):
    ormar_config = dbconf.copy(tablename="submitters")
    
    id:         SubmitterID                 = ormar.Integer(primary_key=True)
    name:       str                         = ormar.String(max_length=1024)
    code:       str                         = ormar.String(max_length=1024*1024)
    kargs:      Dict[str, Dict[str, Any]]   = ormar.JSON(default={})
    created_at: AwareDatetime               = ormar.DateTime(timezone=True, default=datetime_now)


def dummy_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper


def get_dbenv_func(var_name: str, default_func:Callable|None = None, value_cached:bool=False):
    final_decorator = cached() if value_cached else dummy_decorator 
    @final_decorator
    async def FUNC() -> str:
        value = await Env.objects.get_or_none(key=var_name)
        value = value.value if value else None
        if value is None:
            value = default_func() if default_func else None
            await Env(key=var_name, value=value).save()
        return value
    return FUNC

APP_SECRET = get_dbenv_func("APP_SECRET", lambda: secrets.token_hex(32), value_cached=True)
SERVER_ID = get_dbenv_func("SERVER_ID", lambda: str(uuid4()), value_cached=True)
SUBMITTER_ERROR_OUTPUT = get_dbenv_func("SUBMITTER_ERROR_OUTPUT", lambda: "")
SUBMITTER_WARNING_OUTPUT = get_dbenv_func("SUBMITTER_WARNING_OUTPUT", lambda: "")

async def __async_init_db():
    await connect_db()
    manual_client = await Client.objects.get_or_none(id=MANUAL_CLIENT_ID)
    if not manual_client:
        await Client(id=MANUAL_CLIENT_ID, name="Manual client").save()
    await close_db()

async def init_db():
    while True:
        try:
            if RESET_DB_DANGEROUS:
                print("!!! Resetting database !!!")
                dbconf.metadata.drop_all(dbconf.engine)
            dbconf.metadata.create_all(dbconf.engine)
            await __async_init_db()
            print("Database initialized.")
            
            break
        except sqlalchemy.exc.OperationalError:
            print("Database not ready, retrying...")
            time.sleep(1)
            continue

async def connect_db():
    if dbconf.database.is_connected:
        return dbconf.database
    else:
        connection = await dbconf.database.connect()
        return connection


async def close_db():
    if dbconf.database.is_connected:
        await dbconf.database.disconnect()

transactional = dbconf.database.transaction()

if __name__ == "__main__":
    asyncio.run(init_db())
    print("Database initialized.")