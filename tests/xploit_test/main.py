#!/usr/bin/env python3

import time, random
from exploitfarm import get_host, random_str
from pwn import *

host = get_host()

simulate_random_crash = False
simulate_work = False
simulate_connection = False
random_flags = True
flags_max = 10
flags_min = 5

if simulate_connection:
    remote("google.com", 80).close()

print(f"Hello {host}! This text should contain a lot of flags!")

flags =[random_str(32)+"=" for _ in range(flags_max if not random_flags else random.randint(flags_min, flags_max))]

print(f"Submitted {len(flags)} flags")

if simulate_random_crash:
    fail = random.randint(1, 10) == 3
    fail_time = random.randint(1, 2) == 1

    if fail:
        if fail_time:
            print("Failed to submit flags, timeout")
            time.sleep(99999)
        else:
            if random.randint(1, 2) == 1:
                print("Failed to submit flags, invalid")
                exit(1)
            print("Failed to submit flags, noflags")
            exit(0)

if simulate_work:
    time_duration = 3
    exe_per_seconds = 80

    for i in range(time_duration*exe_per_seconds):
        for i in range(1000):
            pass
        time.sleep(1/exe_per_seconds)
 
print(", ".join(flags))

