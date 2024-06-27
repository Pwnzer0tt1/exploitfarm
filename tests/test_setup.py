#!/usr/bin/env python3

import uvicorn, random
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Tuple
from exploitfarm import get_config
import datetime, argparse

parser = argparse.ArgumentParser(description="GitBackup")
parser.add_argument("--password", "-p", type=str, default=None, help="Setup the environment")
parser.add_argument("--teams", "-T", type=int, default=100, help="Number of teams")
parser.add_argument("--tick", "-t", type=int, default=60, help="Tick duration")
parser.add_argument("--docker", action="store_true", help="Run in docker mode (with host.docker.internal)")
args = parser.parse_args()

app = FastAPI()

def get_random_status(flag):
    choice = random.randrange(1,50)
    if choice == 45:
        return (flag, 'invalid', "The flag is not valid")
    elif choice == 46:
        return (flag, 'timeout', "Too old")
    elif choice == 47:
        return (flag, 'invalid', "NOP flag")
    return (flag, 'ok', f'points: {random.randrange(1,10)}')

@app.post("/", response_model=List[Tuple[str, str, str]])
async def fake_submit(data: List[str]):
    return [get_random_status(ele) for ele in data]
    

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def run_webserver():
    uvicorn.run(
        "test_setup:app",
        host="0.0.0.0",
        port=4456,
        reload=False,
        access_log=True,
        workers=1
    )

SUBMITTER_CODE = f"""
import requests

def submit(flags, url:str = "http://{'host.docker.internal' if args.docker else '127.0.0.1'}:4456/"):
    return requests.post(url, json=flags).json()

"""

def main():
    config = get_config()
    if config.status["status"] != "setup":
        run_webserver()
        return
    submitter_id = config.reqs.new_submitter({
        "code": SUBMITTER_CODE,
        "name": "test_setup"
    })["id"]
    config.reqs.new_teams([{"host":f"127.0.0.{ele}", "name":f"Fake team {ele}"} for ele in range(1, args.teams+1)])
    config.reqs.configure_server(
        flag_regex="[a-zA-Z0-9]{32}=",
        start_time=datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
        tick_duration=args.tick,
        flag_timeout=args.tick*3,
        attack_mode="tick-delay",
        submitter=submitter_id,
        set_running=True,
        password_hash=args.password,
        authentication_required=not args.password is None
    )

    run_webserver()

def setup():
    try:
        main()
    except KeyboardInterrupt:
        pass

if __name__ == '__main__':
    setup()
