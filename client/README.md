# Exploit Farm python library

ExploitFarm is a flag submitter and attack manager for Attack-Defense CTFs.
The project is composed by a client and a server thats cooperates to manage the attacks and the flags.
The design is directly inspired by [destructive farm](https://gitbub.com/DestructiveVoice/DestructiveFarm) but completely rewritten and feature rich.
Find more information about this project on [exploitfarm](https://github.com/pwnzer0tt1/exploitfarm) github page and our team page [Pwnzer0tt1](https://pwnzer0tt1.it/)

This library is used to interact with the Exploit Farm APIs.

## Installation

```bash
pip3 install -U exploitfarm && xfarm --install-completion
```

## Usage

```python
import time, random
from exploitfarm import *

#Exploit example
host = get_host() #This should usually contains the ip of the team to attack

print(f"Hello {host}! This text should contain a lot of flags!")

flags =[random_str(32)+"=" for _ in range(100)]

print(f"Submitting {len(flags)} flags: {', 'f.join(flags)}")
```

## Functions

```python
from exploifarm import *

get_host() #Gets you the XFARM_HOST environment variable
Prio #Enum with high, normal and low values to set the priority of the process
nicenessify(priority=Prio.low) #Set the priority of the process (xfarm will set the priority of the process to low by default allowing strange behaviour on the system)
get_config() #Get the configuration of the client
random_str(
    length:int|None = None,
    length_range:int = (8,12),
    numbers:bool = True,
    lower:bool = True,
    upper:bool = True,
    specials:bool = False,
    exclude:str = "",
    include:str = ""
) #Generate a random string with the specified parameters (usefull to anonymize the exploit)

session(
    random_agent:bool = True,
    additional_agents:list = [],
    additional_headers:dict = {},
    user_agent:str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/
) #Create a session with the specified headers (random_agent will set a random user agent)
try_tcp_connection(
    address:str,           #Address to connect
    timeout:float|None = 3 #Timeout of the connection
) -> tuple[bool, str|None] #Try to connect to the address with a tcp connection
```

When you import the library, the `print` function is replaced with a version that flushes the output. This is useful if in some cases the exploit is killed before the output is flushed.

## xFarm CLI

Exploit farm has a CLI command (xFarm) that gives you different features to interact with the server and for starting exploits.
Some parts of the managment of the exploit are inspired and in some part copied from [destructive farm](https://github.com/DestructiveVoice/DestructiveFarm), but with a lot of improvements and an amazing Terminal UI based on [textual](https://textual.textualize.io/).

## Main Commands


### `init`

Initiate a new exploit folder.
This command will create a new exploit folder with the necessary files and directories, in the folder there will be a config.toml file with all the information needed to run your exploit, you can change some of these options if needed.

**Syntax:**
```bash
xFarm init [OPTIONS]
```

**Options:**
- `--edit`: Edit the exploit configuration.
- `--name`: The name of the exploit.
- `--service`: The service of the exploit.
- `--language`: The language of the exploit.

after you created the exploit you can run it with the start command.

### `start`

Start the exploit.

**Syntax:**
```bash
xFarm start [OPTIONS] PATH
```

**Options:**
- `PATH`: The path of the exploit (default: `.`).
- `--pool_size`: Number of workers to start (default: `50`).
- `--submit_pool_timeout`: Timeout for the submit pool to wait for new attack results and send flags (default: `3`).
- `--server_status_refresh_period`: Period to refresh the server status (default: `5`).
- `--test`: Test the exploit.
- `--test_timeout`: Timeout for the test (default: `10`).


## Other Commands

### `config`

Configure client settings.

**Syntax:**
```bash
xFarm config [OPTIONS]
```

Here will be shown a tui requiring server address and port, and a nickname for the client. All this information are needed to connect to the server and required if missing in every command is required.

### `reset`

Reset client settings.

**Syntax:**
```bash
xFarm reset
```

**Description:**
- Prompts for confirmation before resetting.
- Resets the client's settings to default values.

### `login`

Log in to the server.

**Syntax:**
```bash
xFarm login [OPTIONS]
```

The login will be always required if needed automatically in every command.

**Options:**
- `--password`: The user's password.
- `--stdin`: Read the password from stdin.

### `logout`

Log out from the server.

**Syntax:**
```bash
xFarm logout
```

**Description:**
- Removes the server's authentication key from the client config.

### `submitter_test`

Test a submitter.

**Syntax:**
```bash
xFarm submitter_test [OPTIONS] PATH OUTPUT
```

**Options:**
- `PATH`: Path to the submitter Python script.
- `--kwargs`: Submitter keyword arguments (in JSON format).
- `OUTPUT`: Text containing flags according to the server's REGEX.

### `status`

Get the server status.

**Syntax:**
```bash
xFarm status [OPTIONS] [WHAT]
```

**Options:**
- `WHAT`: Type of server information (default: `status`).

## Global Options

The CLI supports a global option for interactive mode.

- `--no-interactive`: Disables interactive configuration mode.
In interactive mode, a "semi-graphical" terminal interface will open, allowing you to enter data interactively.
