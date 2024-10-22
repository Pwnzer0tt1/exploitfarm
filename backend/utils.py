from passlib.context import CryptContext
from typing import Tuple, List, Any
import time, ast, os, traceback
from datetime import datetime, UTC
from fastapi import FastAPI, APIRouter
from pydantic import BaseModel
from fastapi import HTTPException
import re, logging, ormar
from sqlalchemy.sql.dml import Insert
from models.response import MessageInfo
import orjson, gzip, dirhash


#logging.getLogger().setLevel(logging.DEBUG)
logging.basicConfig(format="[EXPLOIT-FARM][%(asctime)s] >> [%(levelname)s][%(name)s]:\t%(message)s", datefmt="%d/%m/%Y %H:%M:%S")
crypto = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALLOWED_ANNOTATIONS = ["int", "str", "bool", "float", "any"]
ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
ROUTERS_DIR_NAME = "routes"
ROUTERS_DIR = os.path.join(ROOT_DIR, ROUTERS_DIR_NAME)

def extract_function(fun_name:str, code: bytes) -> ast.FunctionDef|None:
    try:
        node = ast.parse(code)
        function = [n for n in node.body if isinstance(n, ast.FunctionDef) and n.name == fun_name]
        if len(function) > 0:
            return function[0], "ok"
    except Exception as e:
        return None, f"Error parsing the code: {e}"
    return None, f"Function called '{fun_name}' not found"

def _extract_value_or_none(value: Any) -> Any:
    try:
       return value.value
    except:
        return None

def _extract_annotation_or_any(value: Any) -> Any:
    try:
       return value.annotation.id.lower()
    except:
        return "any"


def type_check_annotation(value:Any, annot: str) -> bool:
    match annot:
        case "int":
            return isinstance(value, int)
        case "str":
            return isinstance(value, str)
        case "bool":
            return isinstance(value, bool)
        case "float":
            return isinstance(value, float)
        case "any":
            return True
    return False

def extract_function_info(fun: ast.FunctionDef) -> Tuple[List[str], List[str]]:
    args = [(arg.arg, _extract_annotation_or_any(arg)) for arg in fun.args.args]
    default_args = [_extract_value_or_none(ele) for ele in fun.args.defaults]
    return args, default_args

def has_submit_signature(fun: ast.FunctionDef) -> bool:
    args, default_args = extract_function_info(fun)
    if len(args) == 0:
        return False, "The function must have at least one argument"
    if args[0][0] != "flags":
        return False, "The first argument must be named 'flags'"
    if args[0][1] != "any":
        return False, "The first argument cannot have an annotation"
    if len(default_args) == len(args):
        return False, "The first argument cannot have a default value"
    for name, annot in args:
        if not annot in ALLOWED_ANNOTATIONS:
            return False, f"Argument {name} cannot have an annotation, only {", ".join(ALLOWED_ANNOTATIONS)} are allowed"
    return True, "ok"

def _get_if_allowed_type_else_none(value: Any) -> Any:
    if isinstance(value, (int, str, bool, float, type(None))):
        return value
    return None
    
def get_additional_args(fun: ast.FunctionDef) -> dict:
    args, default_args = extract_function_info(fun)
    args = args[1:]
    none_padding = len(args) - len(default_args)
    default_args = [None]*none_padding + default_args
    return {k[0]:{
        "value": _get_if_allowed_type_else_none(v),
        "type": k[1]
    } for k,v in zip(args, default_args)}

def extract_submit(code: bytes) -> Tuple[ast.FunctionDef|None, str]:
    return extract_function("submit", code)

class Scheduler:
    def __init__(self, func:callable, interval:int|None = None, args:tuple=None, kwargs:dict=None):
        self.args = args if args else tuple()
        self.kwargs = kwargs if kwargs else dict()
        self.interval = interval
        self.func = func
        self._last_execution = 0

    async def commit(self):
        if self.interval is None or time.time() - self._last_execution > self.interval:
            self._last_execution = time.time()
            await self.func(*self.args, **self.kwargs)
        
    def reset_exec(self):
        self._last_execution = 0

def datetime_now() -> datetime:
    return datetime.now(UTC)

def list_files(mypath):
    from os import listdir
    from os.path import isfile, join
    return [f for f in listdir(mypath) if isfile(join(mypath, f))]

def list_routers():
    return [ele[:-3] for ele in list_files(ROUTERS_DIR) if ele != "__init__.py" and " " not in ele and ele.endswith(".py")]

def load_routers(app: FastAPI|APIRouter):
    for route in list_routers():
        try:
            module = getattr(__import__(f"{ROUTERS_DIR_NAME}.{route}"), route, None)
            if not module:
                raise Exception()
        except Exception:
            traceback.print_exc()
            raise Exception(f"Error loading router {route}! Check if the file is correct")
        try:
            router = getattr(module, "router", None)
            if not router or not isinstance(router, APIRouter):
                raise Exception()
        except Exception:
            raise Exception(f"Error loading router {route} in every route has to be defined a 'router' APIRouter from fastapi!")
        app.include_router(router)

def json_like(obj: BaseModel|List[BaseModel]):
    if isinstance(obj, list):
        return [ele.model_dump(mode="json", exclude_unset=True) for ele in obj]
    return obj.model_dump(mode="json", exclude_unset=True)

async def check_only_setup():
    from models.config import Configuration, SetupStatus
    config = await Configuration.get_from_db()
    if config.SETUP_STATUS != SetupStatus.SETUP:
        raise HTTPException(400, "You can delete all teams only in SETUP status")

def _extract_values_by_regex(regex:str|bytes, text:str|list[str|bytes]):
    matcher = re.compile(regex if isinstance(regex, bytes) else regex.encode())
    if isinstance(text, str):
        text = [text]
    for ele in text:
        for value in matcher.findall(ele if isinstance(ele, bytes) else ele.encode()):
            yield value.decode()

def extract_values_by_regex(regex:str, text:str|list[str]) -> list[str]:
    return list(_extract_values_by_regex(regex, text))

async def bulk_insert(objects:List[ormar.Model], postfix=None):
    if len(objects) == 0:
        return
    flags_saves = [obj.prepare_model_to_save(obj.model_dump()) for obj in objects]
    expr:Insert = type(objects[0]).ormar_config.table.insert().values(flags_saves)
    if postfix and postfix[0] != " ":
        postfix = " "+postfix
    if not postfix:
        postfix = ""
    query = str(expr.compile(compile_kwargs={"literal_binds": True}))+postfix #Works on Postgres
    await type(objects[0]).ormar_config.database.execute(query)
    for obj in objects:
        obj.set_save_status(True)

async def _get_messages_array():
    """ This function will recognize problems, dangerous situations and errors detected by the system, and collect them in a list """
    from db import SUBMITTER_ERROR_OUTPUT, MessageStatusLevel, SUBMITTER_WARNING_OUTPUT
    # Submitter exceptions
    error = await SUBMITTER_ERROR_OUTPUT()
    warning = await SUBMITTER_WARNING_OUTPUT()
    if error:
        yield MessageInfo(
            level=MessageStatusLevel.error,
            title="The submitter gave an unexpected exception! That's a problem in your submitter",
            message=error
        )
    if warning:
        yield MessageInfo(
            level=MessageStatusLevel.warning,
            title="The submitter gave a warning! Check the output",
            message=warning
        )
    #yield other messages here!
    
async def get_messages_array() -> List[MessageInfo]:
    """ This function will recognize problems, dangerous situations and errors detected by the system, and collect them in a list """
    return [ele async for ele in _get_messages_array()]
    
async def create_or_update_env(key:str, value:str):
    from db import Env
    var = await Env.objects.filter(key=key).get_or_none()
    if var:
        return await var.update(value=value)
    else:
        await Env(key=key, value=value).save()

async def get_db_stats(test:bool=False):
    from db import BinEnv
    if test: return await BinEnv.objects.filter(BinEnv.key == "STATS").count() > 0
    encodedjson = await BinEnv.objects.filter(BinEnv.key == "STATS").get_or_none()
    if encodedjson is None:
        return None
    return orjson.loads(gzip.decompress(encodedjson.value))

async def set_db_stats(stats:dict):
    from db import BinEnv
    data = gzip.compress(orjson.dumps(stats))
    if not await get_db_stats(True):
        await BinEnv(key="STATS", value=data).save()
    else:
        await BinEnv.objects.filter(BinEnv.key == "STATS").update(value=data)
    