#!/usr/bin/env python3
from __future__ import annotations
import argparse, sys, os, multiprocessing, subprocess

pref = "\033["
reset = f"{pref}0m"
composefile = "exploitfarm-compose-tmp-file.yml"
container_name = "exploitfarm"
compose_project_name = "exploitfarm"
compose_volume_name = "exploitfarm_data"
container_repo = "ghcr.io/pwnzer0tt1/exploitfarm"
name = "ExploitFarm"
os.chdir(os.path.dirname(os.path.realpath(__file__)))
volume_name = f"{container_name}_{compose_volume_name}"

#Terminal colors

class colors:
    black = "30m"
    red = "31m"
    green = "32m"
    yellow = "33m"
    blue = "34m"
    magenta = "35m"
    cyan = "36m"
    white = "37m"

def puts(text, *args, color=colors.white, is_bold=False, **kwargs):
    print(f'{pref}{1 if is_bold else 0};{color}' + text + reset, *args, **kwargs)

def sep(): puts("-----------------------------------", is_bold=True)

def check_if_exists(program):
    return subprocess.call(['sh', '-c', program], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT) == 0

def composecmd(cmd, composefile=None):
    if composefile:
        cmd = f"-f {composefile} {cmd}"
    if not check_if_exists("docker ps"):
        return puts("Cannot use docker, the user hasn't the permission or docker isn't running", color=colors.red)
    elif check_if_exists("docker compose"):
        return os.system(f"docker compose -p {compose_project_name} {cmd}")
    elif check_if_exists("docker-compose"):
        return os.system(f"docker-compose -p {compose_project_name} {cmd}")
    else:
        puts("Docker compose not found! please install docker compose!", color=colors.red)

def dockercmd(cmd):
    if check_if_exists("docker"):
        return os.system(f"docker {cmd}")
    elif not check_if_exists("docker ps"):
        puts("Cannot use docker, the user hasn't the permission or docker isn't running", color=colors.red)
    else:
        puts("Docker not found! please install docker!", color=colors.red)

def check_already_running():
    return check_if_exists(f"docker ps --filter 'name=^{container_name}$' --no-trunc | grep {container_name}")

def gen_args(args_to_parse: list[str]|None = None):                     
    
    #Main parser
    parser = argparse.ArgumentParser(description=f"{name} Manager")
    if os.path.isfile("./Dockerfile"):
        parser.add_argument('--build', "-b", dest="bef_build", required=False, action="store_true", help='Build the container from source', default=False)
    parser.add_argument('--clear', dest="bef_clear", required=False, action="store_true", help=f'Delete docker volume associated to {name} resetting all the settings', default=False)

    subcommands = parser.add_subparsers(dest="command", help="Command to execute [Default start if not running]")
    
    #Compose Command
    parser_compose = subcommands.add_parser('compose', help='Run docker compose command')
    parser_compose.add_argument('compose_args', nargs=argparse.REMAINDER, help='Arguments to pass to docker compose', default=[])
    
    #Start Command
    parser_start = subcommands.add_parser('start', help=f'Start {name}')
    parser_start.add_argument('--threads', "-t", type=int, required=False, help='Number of threads started for each service/utility', default=-1)
    parser_start.add_argument('--port', "-p", type=int, required=False, help='Port where open the web service', default=5050)
    parser_start.add_argument('--logs', required=False, action="store_true", help=f'Show {name} logs', default=False)
    if os.path.isfile("./Dockerfile"):
        parser_start.add_argument('--build', "-b", required=False, action="store_true", help='Build the container from source', default=False)


    #Stop Command
    parser_stop = subcommands.add_parser('stop', help=f'Stop {name}')
    parser_stop.add_argument('--clear', required=False, action="store_true", help=f'Delete docker volume associated to {name} resetting all the settings', default=False)
    
    parser_restart = subcommands.add_parser('restart', help=f'Restart {name}')
    parser_restart.add_argument('--logs', required=False, action="store_true", help=f'Show {name} logs', default=False)
    args = parser.parse_args(args=args_to_parse)
    
    if not "clear" in args:
        args.clear = False
    
    if not "threads" in args or args.threads < 1:
        args.threads = multiprocessing.cpu_count()
    
    if not "port" in args or args.port < 1:
        args.port = 5050
    
    if not "bef_build" in args:
        args.bef_build = False
    
    if not "build" in args:
        args.build = False
    
    if args.command is None:
        if not args.clear:
            return gen_args(["start", *sys.argv[1:]])
        
    args.build = args.bef_build or args.build
    args.clear = args.bef_clear or args.clear

    return args

args = gen_args()

def write_compose():
    with open(composefile,"wt") as compose:
        compose.write(f"""
services:
    exploitfarm:
        restart: unless-stopped
        container_name: {container_name}
        {"build: ." if args.build else f"image: {container_repo}"}
        environment:
            - NTHREADS={args.threads}
            - POSTGRES_USER={container_name}
            - POSTGRES_PASSWORD={container_name}
            - POSTGRES_DB={container_name}
        extra_hosts:
            - "host.docker.internal:host-gateway"
        ports:
            - {args.port}:5050
        depends_on:
            - database
    database:
        image: postgres
        restart: unless-stopped
        container_name: {container_name}-database
        command: ["postgres", "-c", "max_connections=1000"]
        environment:
            - POSTGRES_USER={container_name}
            - POSTGRES_PASSWORD={container_name}
            - POSTGRES_DB={container_name}
        volumes:
            - {compose_volume_name}:/var/lib/postgresql/data
volumes:
    {compose_volume_name}:
""")

def volume_exists():
    return check_if_exists(f'docker volume ls --filter="name=^{volume_name}$" --quiet | grep {volume_name}')

def delete_volume():
    return dockercmd(f"volume rm {volume_name}")

def main():
    
    if not check_if_exists("docker"):
        puts("Docker not found! please install docker and docker compose!", color=colors.red)
        exit()
    elif not check_if_exists("docker-compose") and not check_if_exists("docker compose"):
        print(check_if_exists("docker-compose"), check_if_exists("docker compose"))
        puts("Docker compose not found! please install docker compose!", color=colors.red)
        exit()
    if not check_if_exists("docker ps"):
        puts("Cannot use docker, the user hasn't the permission or docker isn't running", color=colors.red)
        exit()    
    
    if args.command:
        match args.command:
            case "start":
                if check_already_running():
                    puts(f"{name} is already running! use --help to see options useful to manage {name} execution", color=colors.yellow)
                else:
                    puts(f"{name}", color=colors.yellow, end="")
                    puts(" will start on port ", end="")
                    puts(f"{args.port}", color=colors.cyan)
                    write_compose()
                    if not args.build:
                        puts(f"Downloading docker image from github packages 'docker pull {container_repo}'", color=colors.green)
                        dockercmd(f"pull {container_repo}")
                    puts("Running 'docker compose up -d --build'\n", color=colors.green)
                    composecmd("up -d --build", composefile)
            case "compose":
                write_compose()
                compose_cmd = " ".join(args.compose_args)
                puts(f"Running 'docker compose {compose_cmd}'\n", color=colors.green)
                composecmd(compose_cmd, composefile)
            case "restart":
                if check_already_running():
                    write_compose()
                    puts("Running 'docker compose restart'\n", color=colors.green)
                    composecmd("restart", composefile)
                else:
                    puts(f"{name} is not running!" , color=colors.red, is_bold=True, flush=True)
            case "stop":
                if check_already_running():
                    write_compose()
                    puts("Running 'docker compose down'\n", color=colors.green)
                    composecmd("down", composefile)
                else:
                    puts(f"{name} is not running!" , color=colors.red, is_bold=True, flush=True)
    
    write_compose()
    
    if args.clear:
        if volume_exists():
            delete_volume()
        else:
            puts(f"{name} volume not found!", color=colors.red)

    if "logs" in args and args.logs:
        composecmd("logs -f")


if __name__ == "__main__":
    try:
        try:
            main()
        finally:
            if os.path.isfile(composefile):
                os.remove(composefile)
    except KeyboardInterrupt:
        print()
